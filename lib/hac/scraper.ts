/**
 * Home Access Center (HAC) Web Scraper Service
 * TypeScript implementation for scraping grades from HAC
 * 
 * Improvements over previous version (inspired by GradeView):
 * - ASP.NET PostBack-based cycle switching (reliable, not URL-param guessing)
 * - Full assignment data parsing (earnedPoints, totalPoints, weight, percentage)
 * - Retry with exponential backoff on transient failures
 * - Returns cycle metadata (availableCycles, currentCycle) from grades endpoint
 * - Deterministic highlighted course (highest grade, not random)
 * - Richer course-level detection (AP, Dual Credit, Pre-AP, IB, OnRamps)
 * - Grade < 70 → GPA 0 rule; grade capped at 100 for GPA
 */

import * as cheerio from 'cheerio';
import { 
  HACCredentials, 
  HACSession, 
  HACCourse, 
  HACAssignment,
  HACCycleOption,
  HACReportCard,
  HACReportCardCycle,
  HACGradesResponse,
  HACGPACalculation,
  DEFAULT_HAC_BASE_URL,
  HAC_ENDPOINTS,
  CourseLevel
} from './types.js';
import { encryptSession, decryptSession, SessionPayload } from './session-token.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Retry configuration for transient network/server errors */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,  // 500ms → 1000ms → 2000ms
};

/** Regex patterns for finding the cycle dropdown by ID */
const CYCLE_DROPDOWN_ID_PATTERN = /plnMain_ddlReportCardRuns|ddlReportPeriods|ddlCompetencies|ddlReportingPeriod|plnMain_ddlReportPeriods|plnMain_ddlCompetencies/;

/** Keywords that indicate an option belongs to a cycle/reporting-period dropdown */
const CYCLE_KEYWORDS = ['CYCLE', 'REPORTING PERIOD', 'INTERIM', 'SEMESTER', 'QUARTER', 'RUN'];

// ─── Cookie Jar ─────────────────────────────────────────────────────────────────

class CookieJar {
  private cookies = new Map<string, string>();
  
  addFromResponse(response: Response) {
    let setCookieHeaders: string[] = [];
    
    if (typeof (response.headers as any).getSetCookie === 'function') {
      setCookieHeaders = (response.headers as any).getSetCookie();
    } else if (typeof (response.headers as any).raw === 'function') {
      const rawHeaders = (response.headers as any).raw();
      setCookieHeaders = rawHeaders['set-cookie'] || [];
    } else {
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        setCookieHeaders = [setCookieHeader];
      }
    }
    
    for (const setCookie of setCookieHeaders) {
      const cookiePart = setCookie.split(';')[0];
      const eqIndex = cookiePart.indexOf('=');
      if (eqIndex > 0) {
        const name = cookiePart.substring(0, eqIndex).trim();
        const value = cookiePart.substring(eqIndex + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }
  
  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
  
  size(): number {
    return this.cookies.size;
  }
}

// ─── Network Helpers ────────────────────────────────────────────────────────────

/**
 * Fetch with cookie support and manual redirect following.
 */
async function fetchWithCookies(
  url: string, 
  cookieJar: CookieJar, 
  options: RequestInit = {}
): Promise<{ response: Response; finalUrl: string }> {
  const MAX_REDIRECTS = 10;
  let currentUrl = url;
  let redirectCount = 0;
  let response: Response;
  
  while (redirectCount < MAX_REDIRECTS) {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      ...(options.headers as Record<string, string> || {})
    };
    
    const cookieString = cookieJar.toString();
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }
    
    response = await fetch(currentUrl, {
      ...options,
      headers,
      redirect: 'manual'
    });
    
    cookieJar.addFromResponse(response);
    
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      
      // After POST redirect, switch to GET (HTTP 303 semantics)
      if (options.method === 'POST') {
        options = { ...options, method: 'GET', body: undefined };
      }
      continue;
    }
    
    break;
  }
  
  return { response: response!, finalUrl: currentUrl };
}

/**
 * Fetch with automatic retry and exponential backoff.
 * Only retries on network errors or 5xx server errors, NOT on 3xx/4xx.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = RETRY_CONFIG.maxRetries
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on redirects (session expired) or client errors
      if (response.status < 500) {
        return response;
      }
      
      // 5xx → retry
      if (attempt < retries) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.log(`[HAC] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retries) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.log(`[HAC] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries}):`, lastError.message);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Session Management ─────────────────────────────────────────────────────────

/**
 * Resolve a session token into a HACSession object.
 * The token is a stateless encrypted blob (no in-memory Map).
 * Returns null if the token is invalid or expired.
 */
export function resolveSession(sessionToken: string): HACSession | null {
  const payload = decryptSession(sessionToken);
  if (!payload) {
    console.error('[HAC] Invalid session token');
    return null;
  }

  if (payload.expiresAt < Date.now()) {
    console.error('[HAC] Session token expired');
    return null;
  }

  return {
    sessionId: sessionToken,
    cookies: payload.cookies,
    expiresAt: new Date(payload.expiresAt),
    credentials: {
      username: payload.username,
      password: payload.password,
      districtBaseUrl: payload.baseUrl,
    },
  };
}

// ─── GPA Calculation ────────────────────────────────────────────────────────────

/**
 * Detect course level from course name/code with comprehensive pattern matching.
 * Matches patterns: AP, A.P., DC, Dual Credit, OnRamps, IB, Pre-AP, PAP, ADV, ADVANCED, HONORS, GT
 */
export function getCourseLevel(courseName: string): CourseLevel {
  const upper = courseName.toUpperCase();
  
  // AP patterns: "AP ", " AP", "A.P.", "AP-"
  if (/\bAP\b|A\.P\./i.test(courseName)) {
    return 'ap';
  }
  
  // Dual Credit patterns: "DC ", " DC", "DUAL CREDIT", "DUAL", "ONRAMPS", "ON RAMPS", "ON-RAMPS"
  if (/\bDC\b|\bDUAL\s*CREDIT\b|\bDUAL\b|\bONRAMPS\b|\bON[\s-]RAMPS\b/i.test(courseName)) {
    return 'dual';
  }
  
  // IB (International Baccalaureate) — treated same as AP
  if (/\bIB\b/i.test(courseName)) {
    return 'ap';
  }
  
  // Pre-AP patterns: "PRE-AP", "PREAP", "PAP", "PRE AP"
  if (/\bPRE[\s-]?AP\b|\bPAP\b/i.test(courseName)) {
    return 'preap';
  }
  
  // Advanced/Honors patterns: "ADV", "ADVANCED", "HONORS", "GT", "GIFTED"
  if (upper.includes('ADV') || upper.includes('ADVANCED') || upper.includes('HONORS') || 
      upper.includes('GT') || upper.includes('GIFTED')) {
    return 'advanced';
  }
  
  return 'regular';
}

/**
 * Calculate GPA for a grade based on course level.
 * Uses the Leander ISD / Texas 6.0 scale:
 *   AP/Dual = 6.0, Pre-AP/Advanced/Honors = 5.5, Regular = 5.0
 *   GPA = maxGPA - (100 - grade) × 0.1
 *   Below 70 = 0 (failing). Grade capped at 100.
 */
export function calculateGpaForGrade(gradePercent: number, courseName: string): number {
  // Cap grade at 100 for GPA purposes (no extra credit inflation)
  const cappedGrade = Math.min(gradePercent, 100);
  const roundedGrade = Math.round(cappedGrade);
  
  // Below 70 is failing
  if (roundedGrade < 70) {
    return 0;
  }
  
  const level = getCourseLevel(courseName);
  
  let baseGpa: number;
  switch (level) {
    case 'ap':
    case 'dual':
      baseGpa = 6.0;
      break;
    case 'preap':
    case 'advanced':
      baseGpa = 5.5;
      break;
    default:
      baseGpa = 5.0;
  }
  
  const pointsBelow100 = 100 - roundedGrade;
  const gpa = baseGpa - (pointsBelow100 * 0.1);
  
  return Math.max(0, Math.min(gpa, baseGpa));
}

// ─── Login / Auth ───────────────────────────────────────────────────────────────

/**
 * Create a session and login to HAC.
 */
export async function createSessionAndLogin(
  username: string, 
  password: string,
  baseUrl: string = DEFAULT_HAC_BASE_URL
): Promise<{ session: HACSession | null; error: string | null }> {
  try {
    console.log('[HAC] Attempting login to:', baseUrl);
    const loginUrl = `${baseUrl}${HAC_ENDPOINTS.LOGIN}`;
    
    const cookieJar = new CookieJar();
    
    // GET the login page to extract form tokens
    const { response: loginPageResponse } = await fetchWithCookies(loginUrl, cookieJar, {
      method: 'GET'
    });
    
    if (!loginPageResponse.ok) {
      console.error('[HAC] Failed to access login page:', loginPageResponse.status);
      return { session: null, error: 'Failed to access HAC login page' };
    }
    
    const loginPageHtml = await loginPageResponse.text();
    const $ = cheerio.load(loginPageHtml);
    
    // Build login form data with all hidden fields
    const loginData = new URLSearchParams();
    loginData.append('Database', '10');
    loginData.append('LogOnDetails.UserName', username);
    loginData.append('LogOnDetails.Password', password);
    
    $('form input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name');
      const value = $(el).attr('value') || '';
      if (name) {
        loginData.append(name, value);
      }
    });
    
    console.log('[HAC] Submitting login form...');
    
    const { response: loginResponse, finalUrl } = await fetchWithCookies(loginUrl, cookieJar, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: loginData.toString()
    });
    
    console.log('[HAC] Login response status:', loginResponse.status, 'final URL:', finalUrl);
    
    // Still on login page = failed
    if (finalUrl.includes('LogOn')) {
      console.error('[HAC] Login failed - still on login page');
      return { session: null, error: 'Invalid username or password' };
    }
    
    if (cookieJar.size() === 0) {
      console.error('[HAC] Login failed - no cookies received');
      return { session: null, error: 'Unable to establish session with HAC. The server may be unreachable or blocking automated access.' };
    }
    
    const finalCookies = cookieJar.toString();
    console.log('[HAC] Login successful! Cookies:', cookieJar.size());
    
    const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    const token = encryptSession({
      cookies: finalCookies,
      username,
      password,
      baseUrl,
      expiresAt,
    });
    
    const session: HACSession = {
      sessionId: token,
      cookies: finalCookies,
      expiresAt: new Date(expiresAt),
      credentials: { username, password, districtBaseUrl: baseUrl }
    };
    
    return { session, error: null };
  } catch (error) {
    console.error('[HAC] Login error:', error);
    return { session: null, error: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Validate a session token.
 * Returns true if the token is valid and not expired;
 * the token is stateless so no re-login is attempted here.
 * The frontend handles re-login via fetchWithAuth.
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const session = resolveSession(sessionId);
  return session !== null;
}

export function getSession(sessionId: string): HACSession | undefined {
  return resolveSession(sessionId) ?? undefined;
}

// ─── HTML Parsing Helpers ───────────────────────────────────────────────────────

/**
 * Check if the page HTML indicates we're on the login page (session expired).
 */
function isLoginPage($: cheerio.CheerioAPI, html: string): boolean {
  const pageTitle = $('title').text().toLowerCase();
  const hasLoginForm = $('#LogOnDetails_UserName').length > 0 || 
                        $('input[name="LogOnDetails.UserName"]').length > 0;
  
  return pageTitle.includes('log on') || 
         hasLoginForm || 
         (html.includes('LogOn') && html.includes('Password'));
}

/**
 * Safely parse a string to float, returning null on failure.
 */
function safeParseFloat(value: string | undefined | null): number | null {
  if (!value || value === 'N/A' || value === '' || value === '--') return null;
  const cleaned = value.trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse assignments from a class element with full data extraction.
 * Extracts: dateDue, dateAssigned, name, category, score, earnedPoints, totalPoints, weight, percentage
 */
function parseAssignmentsFromClass($: cheerio.CheerioAPI, classElement: any): HACAssignment[] {
  const assignments: HACAssignment[] = [];
  const $class = $(classElement);
  
  const assignmentTable = $class.find('table.sg-asp-table');
  if (!assignmentTable.length) return assignments;
  
  assignmentTable.find('tr.sg-asp-table-data-row').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    
    const dateDue = $(cells[0]).text().trim();
    const dateAssigned = $(cells[1]).text().trim();
    const name = $(cells[2]).text().trim();
    const category = $(cells[3]).text().trim();
    const scoreRaw = cells.length > 4 ? $(cells[4]).text().trim() : 'N/A';
    const totalPointsRaw = cells.length > 5 ? $(cells[5]).text().trim() : '';
    const weightRaw = cells.length > 6 ? $(cells[6]).text().trim() : '';
    
    // Parse numeric values
    const earnedPoints = safeParseFloat(scoreRaw);
    
    let totalPoints = safeParseFloat(totalPointsRaw);
    if (totalPoints === null || totalPoints === 0) {
      totalPoints = 100; // Default to 100 if not specified
    }
    
    let weight = safeParseFloat(weightRaw);
    if (weight === null) {
      weight = 1.0; // Default weight
    }
    
    // Calculate percentage
    let percentage: number | null = null;
    if (earnedPoints !== null && totalPoints > 0) {
      percentage = Math.round((earnedPoints / totalPoints) * 10000) / 100;
    }
    
    assignments.push({
      dateDue,
      dateAssigned,
      name,
      category,
      score: scoreRaw,
      earnedPoints,
      totalPoints,
      weight,
      percentage,
    });
  });
  
  return assignments;
}

// ─── Cycle Dropdown Discovery ───────────────────────────────────────────────────

/**
 * Find the grading cycle dropdown on the Assignments page.
 * Uses multiple strategies matching GradeView's robust approach:
 * 1. Try known element IDs
 * 2. Fallback: search all <select> elements for cycle-like option text
 */
function findCycleDropdown($: cheerio.CheerioAPI): { 
  dropdown: cheerio.Cheerio<any> | null;
  availableCycles: HACCycleOption[];
  currentCycle: string | null;
} {
  let dropdown: cheerio.Cheerio<any> | null = null;
  const availableCycles: HACCycleOption[] = [];
  let currentCycle: string | null = null;
  
  // Strategy 1: Try known IDs
  const byId = $('select').filter((_, el) => {
    const id = $(el).attr('id') || '';
    return CYCLE_DROPDOWN_ID_PATTERN.test(id);
  });
  
  if (byId.length) {
    dropdown = byId.first();
    console.log('[HAC] Found cycle dropdown by ID:', dropdown.attr('id'));
  }
  
  // Strategy 2: Search by option content
  if (!dropdown) {
    console.log('[HAC] Cycle dropdown not found by ID, searching by option content...');
    $('select').each((_, selectEl) => {
      if (dropdown) return; // Already found
      const $select = $(selectEl);
      const options = $select.find('option');
      if (!options.length) return;
      
      let isValid = false;
      options.each((__, optEl) => {
        const txt = $(optEl).text().trim().toUpperCase();
        if (CYCLE_KEYWORDS.some(kw => txt.includes(kw))) {
          isValid = true;
          return false; // break
        }
      });
      
      if (isValid) {
        dropdown = $select;
        console.log('[HAC] Found cycle dropdown by content, ID:', $select.attr('id'));
      }
    });
  }
  
  // Extract options from the found dropdown
  if (dropdown) {
    dropdown.find('option').each((_, optEl) => {
      const text = $(optEl).text().trim();
      const value = $(optEl).attr('value') || '';
      if (text && value) {
        availableCycles.push({ text, value });
        if ($(optEl).attr('selected') !== undefined) {
          currentCycle = value;
        }
      }
    });
  }
  
  return { dropdown, availableCycles, currentCycle };
}

// ─── ASP.NET PostBack Cycle Switching ───────────────────────────────────────────

/**
 * Perform an ASP.NET PostBack to switch the grading cycle.
 * This is the reliable way to switch cycles — it simulates clicking the
 * "Refresh View" button after selecting a different cycle from the dropdown.
 * 
 * Steps (matching GradeView's proven approach):
 * 1. Collect ALL hidden inputs (__VIEWSTATE, __EVENTVALIDATION, etc.)
 * 2. Collect all current <select> values (preserving page state)
 * 3. Update the cycle dropdown to the requested value
 * 4. Set __EVENTTARGET to the refresh button's PostBack target
 * 5. POST back to the same URL
 */
async function switchCycleViaPostBack(
  $: cheerio.CheerioAPI,
  session: HACSession,
  gradesUrl: string,
  cycleDropdown: cheerio.Cheerio<any>,
  targetCycleValue: string
): Promise<cheerio.CheerioAPI | null> {
  const form = $('form');
  if (!form.length) {
    console.error('[HAC] No form found for PostBack');
    return null;
  }
  
  const postData = new URLSearchParams();
  
  // 1. Collect all hidden inputs (VIEWSTATE, EVENTVALIDATION, etc.)
  form.find('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value') || '';
    if (name) {
      postData.append(name, value);
    }
  });
  
  // 2. Collect all current <select> values (preserve page state)
  form.find('select').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    
    const selectedOpt = $(el).find('option[selected]');
    if (selectedOpt.length) {
      postData.set(name, selectedOpt.attr('value') || '');
    } else {
      const firstOpt = $(el).find('option').first();
      if (firstOpt.length) {
        postData.set(name, firstOpt.attr('value') || '');
      }
    }
  });
  
  // 3. Update cycle dropdown to requested value
  const dropdownName = cycleDropdown.attr('name');
  if (dropdownName) {
    postData.set(dropdownName, targetCycleValue);
  }
  
  // 4. Determine the refresh button's __EVENTTARGET
  let refreshTarget = 'ctl00$plnMain$btnRefreshView'; // Default
  
  const refreshBtn = $('button#plnMain_btnRefreshView, input#plnMain_btnRefreshView');
  if (refreshBtn.length) {
    const onclick = refreshBtn.attr('onclick') || '';
    const match = onclick.match(/__doPostBack\('([^']*)'/);
    if (match) {
      refreshTarget = match[1];
    }
  }
  
  console.log('[HAC] PostBack cycle switch → target:', refreshTarget, 'cycle:', targetCycleValue);
  
  postData.set('__EVENTTARGET', refreshTarget);
  postData.set('__EVENTARGUMENT', '');
  
  // 5. POST back
  try {
    const response = await fetchWithRetry(gradesUrl, {
      method: 'POST',
      headers: {
        'Cookie': session.cookies,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData.toString(),
    });
    
    if (!response.ok) {
      console.error('[HAC] PostBack failed:', response.status);
      return null;
    }
    
    const html = await response.text();
    return cheerio.load(html);
  } catch (error) {
    console.error('[HAC] PostBack error:', error);
    return null;
  }
}

// ─── Grade Fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch grades from HAC with ASP.NET PostBack cycle switching.
 * Returns grades, assignments, available cycles, and current cycle.
 * 
 * @param sessionId - The session ID
 * @param cycleValue - Optional cycle value (from availableCycles). If not provided, fetches current/default cycle.
 */
export async function fetchGrades(sessionId: string, cycleValue?: string | number): Promise<HACGradesResponse | null> {
  console.log('[HAC] fetchGrades called, cycle:', cycleValue);
  
  const session = resolveSession(sessionId);
  if (!session) {
    console.error('[HAC] No session found (invalid or expired token)');
    return null;
  }
  
  const baseUrl = session.credentials.districtBaseUrl || DEFAULT_HAC_BASE_URL;
  const gradesUrl = `${baseUrl}${HAC_ENDPOINTS.ASSIGNMENTS}`;
  
  try {
    // 1. Initial GET to load the assignments page
    const response = await fetchWithRetry(gradesUrl, {
      headers: {
        'Cookie': session.cookies,
        'User-Agent': USER_AGENT,
      },
      redirect: 'manual',
    });
    
    // Redirect = session expired
    if (response.status >= 300 && response.status < 400) {
      console.error('[HAC] Session invalid - redirected');
      return null;
    }
    
    if (!response.ok) {
      console.error('[HAC] Failed to fetch grades:', response.status);
      return null;
    }
    
    const html = await response.text();
    let $ = cheerio.load(html);
    
    if (isLoginPage($, html)) {
      console.error('[HAC] Session expired - on login page');
      return null;
    }
    
    // 2. Discover cycle dropdown and available cycles
    let { dropdown: cycleDropdown, availableCycles, currentCycle } = findCycleDropdown($);
    
    console.log('[HAC] Available cycles:', availableCycles.length, 'Current:', currentCycle);
    
    // 3. If a specific cycle is requested and it's different from current, switch via PostBack
    if (cycleValue !== undefined && cycleDropdown) {
      // Normalize: if a number was passed (legacy support), convert to string
      const targetValue = String(cycleValue);
      
      // Check if this value exists in available cycles
      const matchingCycle = availableCycles.find(c => 
        c.value === targetValue || c.text.includes(targetValue)
      );
      
      if (matchingCycle && matchingCycle.value !== currentCycle) {
        console.log('[HAC] Switching cycle from', currentCycle, 'to', matchingCycle.value);
        
        const newPage = await switchCycleViaPostBack($, session, gradesUrl, cycleDropdown, matchingCycle.value);
        if (newPage) {
          $ = newPage;
          currentCycle = matchingCycle.value;
          
          // Re-discover cycles from the new page (they should be the same but current selection changes)
          const rediscovered = findCycleDropdown($);
          availableCycles = rediscovered.availableCycles;
        }
      }
    }
    
    // 4. Parse all classes and their grades/assignments
    const grades: HACCourse[] = [];
    const classes = $('div.AssignmentClass');
    
    console.log('[HAC] Found', classes.length, 'classes');
    
    classes.each((idx, cls) => {
      const $cls = $(cls);
      
      const courseNameElem = $cls.find('a.sg-header-heading');
      if (!courseNameElem.length) return;
      
      const courseName = courseNameElem.text().trim();
      
      // Extract course code from name: "1210ADV - 1 • English II Advanced"
      let courseCode = String(idx);
      const courseCodeMatch = courseName.match(/^([A-Z0-9]+(?:-\s*\d+)?)/);
      if (courseCodeMatch) {
        courseCode = courseCodeMatch[1].trim();
      }
      
      // Get grade average
      const avgElem = $cls.find('span.sg-header-heading.sg-right');
      let gradeText = '';
      let numericGrade: number | null = null;
      let courseGpa: number | null = null;
      
      if (avgElem.length) {
        gradeText = avgElem.text().trim().replace('Cycle Average', '').trim();
        
        if (gradeText) {
          const gradeMatch = gradeText.match(/(\d+\.?\d*)/);
          if (gradeMatch) {
            numericGrade = parseFloat(gradeMatch[1]);
            courseGpa = Math.round(calculateGpaForGrade(numericGrade, courseName) * 100) / 100;
          }
        }
      }
      
      if (!gradeText) {
        gradeText = 'No Grade Yet';
      }
      
      // Parse assignments with full data
      const assignments = parseAssignmentsFromClass($, cls);
      
      grades.push({
        courseId: courseCode,
        name: courseName,
        grade: gradeText,
        numericGrade,
        gpa: courseGpa,
        assignments,
      });
    });
    
    // 5. Calculate overall average
    let total = 0;
    let count = 0;
    for (const grade of grades) {
      if (grade.numericGrade !== null) {
        total += grade.numericGrade;
        count++;
      }
    }
    const overallAverage = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
    
    // 6. Pick highlighted course: highest grade (deterministic, not random)
    const validCourses = grades.filter(g => g.numericGrade !== null);
    let highlightedCourse: HACCourse | null = null;
    if (validCourses.length > 0) {
      highlightedCourse = validCourses.reduce((best, c) => 
        (c.numericGrade || 0) > (best.numericGrade || 0) ? c : best
      );
    }
    
    return {
      grades,
      overallAverage,
      highlightedCourse,
      availableCycles,
      currentCycle,
    };
  } catch (error) {
    console.error('[HAC] Error fetching grades:', error);
    return null;
  }
}

// ─── Assignment Fetching ────────────────────────────────────────────────────────

/**
 * Fetch assignments for a specific course.
 * Uses fetchGrades() internally — this is kept for API compatibility
 * but consumers should prefer using the inline assignments from fetchGrades().
 */
export async function fetchAssignmentsForCourse(
  sessionId: string, 
  courseIndex: number
): Promise<HACAssignment[] | null> {
  const gradesData = await fetchGrades(sessionId);
  if (!gradesData) return null;
  
  const course = gradesData.grades[courseIndex];
  return course?.assignments || [];
}

// ─── Report Card ────────────────────────────────────────────────────────────────

/**
 * Fetch report card data (past cycle grades from the Report Cards page).
 */
export async function fetchReportCard(sessionId: string): Promise<HACReportCard | null> {
  const session = resolveSession(sessionId);
  if (!session) return null;
  
  const baseUrl = session.credentials.districtBaseUrl || DEFAULT_HAC_BASE_URL;
  const reportCardUrl = `${baseUrl}${HAC_ENDPOINTS.REPORT_CARDS}`;
  
  try {
    const response = await fetchWithRetry(reportCardUrl, {
      headers: {
        'Cookie': session.cookies,
        'User-Agent': USER_AGENT,
      },
    });
    
    if (!response.ok) {
      console.error('[HAC] Failed to fetch report card:', response.status);
      return null;
    }
    
    let html = await response.text();
    let $ = cheerio.load(html);
    
    // Check if we need to select the latest report card run
    const dropdown = $('#plnMain_ddlRCRuns');
    if (dropdown.length) {
      const options = dropdown.find('option');
      if (options.length > 0) {
        const lastOption = options.last();
        const lastValue = lastOption.attr('value');
        const selectedOption = dropdown.find('option[selected]');
        const currentValue = selectedOption.length ? selectedOption.attr('value') : undefined;
        
        // If not on the latest run, fetch it
        if (currentValue !== lastValue && lastValue) {
          console.log('[HAC] Switching to latest report card run:', lastValue);
          const parts = lastValue.split('-');
          const rcrun = parts.length >= 2 ? parts[0] : lastValue;
          
          const latestResponse = await fetchWithRetry(`${reportCardUrl}?RCRun=${rcrun}`, {
            headers: {
              'Cookie': session.cookies,
              'User-Agent': USER_AGENT,
            },
          });
          
          if (latestResponse.ok) {
            html = await latestResponse.text();
            $ = cheerio.load(html);
          }
        }
      }
    }
    
    const reportCardTable = $('#plnMain_dgReportCard');
    if (!reportCardTable.length) {
      return { cycles: [], overallGpa: 0 };
    }
    
    // Find header row to map column indices
    let headerRow = reportCardTable.find('tr.sg-asp-table-header-row');
    if (!headerRow.length) {
      headerRow = reportCardTable.find('tr').first();
    }
    
    const headers: string[] = [];
    headerRow.find('th, td').each((_, el) => {
      headers.push($(el).text().trim());
    });
    
    // Map cycle names (C1, C2, etc.) to column indices
    const cycleIndices: Record<string, number> = {};
    headers.forEach((header, idx) => {
      if (/^C\d+$/.test(header)) {
        cycleIndices[header] = idx;
      }
    });
    
    console.log('[HAC] Report card cycle columns:', Object.keys(cycleIndices).join(', '));
    
    // Initialize cycles data
    const cyclesData: Record<string, { course: string; courseCode: string; grade: number; numericGrade: number; gpa: number }[]> = {};
    for (const cycle of Object.keys(cycleIndices)) {
      cyclesData[cycle] = [];
    }
    
    // Parse data rows
    const rows = reportCardTable.find('tr.sg-asp-table-data-row');
    rows.each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      
      const courseCode = $(cells[0]).text().trim();
      const courseLink = $(cells[1]).find('a');
      const courseName = courseLink.length 
        ? courseLink.text().trim() 
        : $(cells[1]).text().trim();
      
      for (const [cycleName, idx] of Object.entries(cycleIndices)) {
        if (idx < cells.length) {
          const gradeText = $(cells[idx]).text().trim();
          if (gradeText && /^\d+$/.test(gradeText)) {
            const grade = parseInt(gradeText, 10);
            const gpa = Math.round(calculateGpaForGrade(grade, courseName) * 100) / 100;
            
            cyclesData[cycleName].push({
              course: courseName,
              courseCode,
              grade,
              numericGrade: grade,
              gpa,
            });
          }
        }
      }
    });
    
    // Build cycles array sorted by cycle number
    const cycles: HACReportCardCycle[] = [];
    const sortedCycleKeys = Object.keys(cyclesData).sort((a, b) => {
      return parseInt(a.substring(1), 10) - parseInt(b.substring(1), 10);
    });
    
    for (const cycleKey of sortedCycleKeys) {
      const courses = cyclesData[cycleKey];
      if (courses.length > 0) {
        const totalGpa = courses.reduce((sum, c) => sum + c.gpa, 0);
        const avgGpa = Math.round((totalGpa / courses.length) * 100) / 100;
        
        cycles.push({
          cycleName: `Cycle ${cycleKey.substring(1)}`,
          courses,
          averageGpa: avgGpa,
        });
      }
    }
    
    // Calculate overall GPA across all cycles
    let overallGpa = 0;
    let totalCourses = 0;
    for (const cycle of cycles) {
      for (const course of cycle.courses) {
        overallGpa += course.gpa;
        totalCourses++;
      }
    }
    overallGpa = totalCourses > 0 
      ? Math.round((overallGpa / totalCourses) * 100) / 100 
      : 0;
    
    return { cycles, overallGpa };
  } catch (error) {
    console.error('[HAC] Error fetching report card:', error);
    return null;
  }
}

// ─── Cumulative GPA ─────────────────────────────────────────────────────────────

/**
 * Calculate cumulative GPA including past cycles.
 */
export async function calculateCumulativeGpa(
  sessionId: string,
  selectedCourseIds: string[],
  excludedCourseNames: string[] = []
): Promise<HACGPACalculation | null> {
  const gradesData = await fetchGrades(sessionId);
  if (!gradesData) return null;
  
  const reportCard = await fetchReportCard(sessionId);
  
  const currentCourseGpas: number[] = [];
  for (const grade of gradesData.grades) {
    if (selectedCourseIds.includes(grade.courseId) && grade.gpa !== null) {
      currentCourseGpas.push(grade.gpa);
    }
  }
  
  const pastCycleGpas: number[] = [];
  const pastCyclesDetail: HACGPACalculation['pastCyclesDetail'] = [];
  
  if (reportCard) {
    for (const cycle of reportCard.cycles) {
      const cycleCourses: { courseName: string; grade: number; gpa: number }[] = [];
      let cycleTotalGpa = 0;
      let cycleCount = 0;
      
      for (const course of cycle.courses) {
        if (excludedCourseNames.includes(course.course)) continue;
        
        cycleTotalGpa += course.gpa;
        cycleCount++;
        cycleCourses.push({
          courseName: course.course,
          grade: course.grade,
          gpa: course.gpa,
        });
      }
      
      if (cycleCount > 0) {
        const cycleAvg = Math.round((cycleTotalGpa / cycleCount) * 100) / 100;
        pastCycleGpas.push(cycleAvg);
        pastCyclesDetail.push({
          cycleName: cycle.cycleName,
          courses: cycleCourses,
          averageGpa: cycleAvg,
        });
      }
    }
  }
  
  const allGpas = [...currentCourseGpas, ...pastCycleGpas];
  const cumulativeGpa = allGpas.length > 0
    ? Math.round((allGpas.reduce((a, b) => a + b, 0) / allGpas.length) * 100) / 100
    : 0;
  
  return {
    cumulativeGpa,
    currentCoursesCount: currentCourseGpas.length,
    pastCyclesCount: pastCycleGpas.length,
    pastCyclesDetail,
  };
}

// ─── Session Lifecycle ──────────────────────────────────────────────────────────

/**
 * Destroy session — no-op for stateless tokens but kept for API compatibility.
 * The client simply discards the token.
 */
export function destroySession(_sessionId: string): void {
  // Stateless: nothing to delete server-side.
}
