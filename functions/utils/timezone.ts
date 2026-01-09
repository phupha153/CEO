/**
 * Timezone Utility - Handles timezone conversion without hardcoding offsets
 * Supports any IANA timezone (e.g., 'Asia/Bangkok', 'America/New_York')
 */

/**
 * Get current time in specified timezone
 * @param {string} timeZone - IANA timezone (default: 'Asia/Bangkok')
 * @returns {Date} Date object representing the current time in the specified timezone
 */
export function getCurrentTimeInTimeZone(timeZone = 'Asia/Bangkok') {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const dateObj = {};
    
    parts.forEach(({ type, value }) => {
        dateObj[type] = value;
    });

    return new Date(
        parseInt(dateObj.year),
        parseInt(dateObj.month) - 1,
        parseInt(dateObj.day),
        parseInt(dateObj.hour),
        parseInt(dateObj.minute),
        parseInt(dateObj.second)
    );
}

/**
 * Get today's date at midnight in specified timezone
 * @param {string} timeZone - IANA timezone (default: 'Asia/Bangkok')
 * @returns {Date} Date object for today at 00:00:00 in the specified timezone
 */
export function getTodayInTimeZone(timeZone = 'Asia/Bangkok') {
    const now = getCurrentTimeInTimeZone(timeZone);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Get configured timezone from environment or use default
 * @returns {string} IANA timezone string
 */
export function getConfiguredTimeZone() {
    return Deno.env.get('TIMEZONE') || 'Asia/Bangkok';
}