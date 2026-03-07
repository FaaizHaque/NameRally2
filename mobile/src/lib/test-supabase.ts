// Test script to check things_data table structure
import { supabase } from './supabase';

export async function testThingsTable() {
  console.log('[Test] Checking things_data table...');

  // Try to get a single row to see the structure
  const { data, error } = await supabase
    .from('things_data')
    .select('*')
    .limit(5);

  if (error) {
    console.log('[Test] Error accessing things_data:', error.message);
    console.log('[Test] Error details:', JSON.stringify(error, null, 2));
    return;
  }

  if (data && data.length > 0) {
    console.log('[Test] things_data columns:', Object.keys(data[0]));
    console.log('[Test] Sample data:', JSON.stringify(data.slice(0, 3), null, 2));
  } else {
    console.log('[Test] things_data table is empty or inaccessible');
  }
}

// Also test a hint query for letter C
export async function testHintQuery() {
  console.log('[Test] Testing hint query for C things...');

  const { data, error } = await supabase
    .from('things_data')
    .select('name')
    .ilike('name', 'c%')
    .limit(10);

  if (error) {
    console.log('[Test] Hint query error:', error.message);
    return;
  }

  console.log('[Test] Hints for C:', data);
}
