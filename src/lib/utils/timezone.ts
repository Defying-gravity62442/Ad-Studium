// Common timezone options with user-friendly names
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
]

/**
 * Detect the user's timezone and find the best match from our supported timezones
 */
export function detectUserTimezone(): string {
  try {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    console.log('Timezone detection: Raw detected timezone:', detectedTimezone)
    
    // Check if the detected timezone is in our list of common timezones
    const timezoneOption = TIMEZONE_OPTIONS.find(option => option.value === detectedTimezone)
    
    if (timezoneOption) {
      console.log('Timezone detection: Exact match found:', detectedTimezone)
      return detectedTimezone
    }
    
    // If detected timezone is not in our list, try to find a close match
    const timezoneParts = detectedTimezone.split('/')
    const matchingOption = TIMEZONE_OPTIONS.find(option => 
      option.value.includes(timezoneParts[timezoneParts.length - 1])
    )
    
    if (matchingOption) {
      console.log('Timezone detection: Close match found:', detectedTimezone, '->', matchingOption.value)
      return matchingOption.value
    }
    
    // If no match found, return UTC as default
    console.log('Timezone detection: No match found, using UTC as default')
    return 'UTC'
  } catch (error) {
    console.warn('Could not detect timezone:', error)
    return 'UTC'
  }
}

/**
 * Get a user-friendly label for a timezone value
 */
export function getTimezoneLabel(timezoneValue: string): string {
  const option = TIMEZONE_OPTIONS.find(option => option.value === timezoneValue)
  return option ? option.label : timezoneValue
}

/**
 * Check if a timezone is supported in our application
 */
export function isSupportedTimezone(timezone: string): boolean {
  return TIMEZONE_OPTIONS.some(option => option.value === timezone)
}
