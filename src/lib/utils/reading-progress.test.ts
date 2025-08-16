/**
 * Tests for reading progress calculation utilities
 */

import { calculateUniquePages, calculateReadingProgress } from './reading-progress'

// Test data
const testLogs = [
  { id: '1', startPage: 1, endPage: 10, sessionDate: new Date(), notes: null },
  { id: '2', startPage: 5, endPage: 15, sessionDate: new Date(), notes: null },
  { id: '3', startPage: 8, endPage: 20, sessionDate: new Date(), notes: null },
]

const testLogsNoOverlap = [
  { id: '1', startPage: 1, endPage: 10, sessionDate: new Date(), notes: null },
  { id: '2', startPage: 11, endPage: 20, sessionDate: new Date(), notes: null },
  { id: '3', startPage: 21, endPage: 30, sessionDate: new Date(), notes: null },
]

const testLogsAdjacent = [
  { id: '1', startPage: 1, endPage: 10, sessionDate: new Date(), notes: null },
  { id: '2', startPage: 10, endPage: 20, sessionDate: new Date(), notes: null },
  { id: '3', startPage: 20, endPage: 30, sessionDate: new Date(), notes: null },
]

// Test functions
export function runTests() {
  console.log('🧪 Running Reading Progress Calculation Tests...')
  
  // Test 1: Overlapping pages
  const overlapResult = calculateUniquePages(testLogs)
  const expectedOverlap = 20 // Pages 1-20 (merged from 1-10, 5-15, 8-20)
  console.log(`Test 1 - Overlapping pages: ${overlapResult} (expected: ${expectedOverlap}) - ${overlapResult === expectedOverlap ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 2: No overlap
  const noOverlapResult = calculateUniquePages(testLogsNoOverlap)
  const expectedNoOverlap = 30 // Pages 1-10 + 11-20 + 21-30
  console.log(`Test 2 - No overlap: ${noOverlapResult} (expected: ${expectedNoOverlap}) - ${noOverlapResult === expectedNoOverlap ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 3: Adjacent pages
  const adjacentResult = calculateUniquePages(testLogsAdjacent)
  const expectedAdjacent = 30 // Pages 1-30 (merged from 1-10, 10-20, 20-30)
  console.log(`Test 3 - Adjacent pages: ${adjacentResult} (expected: ${expectedAdjacent}) - ${adjacentResult === expectedAdjacent ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 4: Empty array
  const emptyResult = calculateUniquePages([])
  console.log(`Test 4 - Empty array: ${emptyResult} (expected: 0) - ${emptyResult === 0 ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 5: Invalid page numbers
  const invalidLogs = [
    { id: '1', startPage: 10, endPage: 5, sessionDate: new Date(), notes: null }, // end < start
    { id: '2', startPage: -1, endPage: 10, sessionDate: new Date(), notes: null }, // negative start
  ]
  const invalidResult = calculateUniquePages(invalidLogs)
  console.log(`Test 5 - Invalid pages: ${invalidResult} (expected: 0) - ${invalidResult === 0 ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 6: Reading progress calculation
  const progress = calculateReadingProgress(testLogs, 50)
  const expectedProgress = { pagesRead: 20, totalPages: 50, percentage: 40 }
  console.log(`Test 6 - Progress calculation: ${JSON.stringify(progress)} (expected: ${JSON.stringify(expectedProgress)}) - ${progress.pagesRead === expectedProgress.pagesRead ? '✅ PASS' : '❌ FAIL'}`)
  
  console.log('🏁 Tests completed!')
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose for testing
  (window as any).runReadingProgressTests = runTests
}
