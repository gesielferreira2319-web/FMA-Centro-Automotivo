
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://lfvvqeyohcryuwndzojc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdnZxZXlvaGNyeXV3bmR6b2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQ5NDIsImV4cCI6MjA4NDg0MDk0Mn0.OY1Ev88RiWFXeskPvHsWJC3xxFsv-nzbiwIF3eD7bXQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuery() {
    // Replace with a known client ID if possible, or just take the first one found
    console.log('Fetching "motor corsa" inventory...');
    const { data: items } = await supabase
        .from('inventory')
        .select('id, name, quantity, origin_vehicle')
        .ilike('name', '%corsa%');
    console.log('Inventory:', JSON.stringify(items, null, 2));

    console.log('Fetching recent sales...');
    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, total, sale_type, created_at, sale_items(quantity, unit_price, inventory(name, origin_vehicle))')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Query Error:', error);
    } else {
        console.log('Sales:', JSON.stringify(sales, null, 2));
    }
}

checkQuery();
