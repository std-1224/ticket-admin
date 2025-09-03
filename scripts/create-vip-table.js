const { createClient } = require('@supabase/supabase-js')

// Read environment variables directly from .env.local
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')

const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.NEXT_PUBLIC_SUPABSE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createVipGuestsTable() {
  console.log('Creating VIP guests table...')

  try {
    // First, let's check if the table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('vip_guests')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('VIP guests table already exists!')
      return
    }

    console.log('Table does not exist, attempting to create...')
    console.log('Note: You may need to create this table manually in the Supabase dashboard.')
    console.log('SQL to run:')
    console.log(`
-- Create VIP guests table
CREATE TABLE IF NOT EXISTS vip_guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'cancelled')),
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vip_guests_event_id ON vip_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_vip_guests_email ON vip_guests(email);
CREATE INDEX IF NOT EXISTS idx_vip_guests_qr_code ON vip_guests(qr_code);
CREATE INDEX IF NOT EXISTS idx_vip_guests_status ON vip_guests(status);
    `)

  } catch (error) {
    console.error('Error checking/creating VIP guests table:', error)
    return
  }
  
  // Insert sample data
  console.log('Inserting sample VIP guests...')
  
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .limit(1)
  
  if (events && events.length > 0) {
    const eventId = events[0].id
    
    const { error: insertError } = await supabase
      .from('vip_guests')
      .insert([
        {
          name: 'Flavia Rodriguez',
          email: 'flavia@example.com',
          event_id: eventId,
          status: 'invited',
          qr_code: 'VIP-1704240000-abc123def',
          notes: 'Special guest speaker'
        },
        {
          name: 'Carlos Gomez',
          email: 'carlos@example.com',
          event_id: eventId,
          status: 'confirmed',
          qr_code: 'VIP-1704240001-def456ghi',
          notes: 'VIP sponsor'
        },
        {
          name: 'Laura Fernandez',
          email: 'laura@example.com',
          event_id: eventId,
          status: 'invited',
          qr_code: 'VIP-1704240002-ghi789jkl',
          notes: 'Media representative'
        }
      ])
    
    if (insertError) {
      console.error('Error inserting sample data:', insertError)
    } else {
      console.log('Sample VIP guests inserted successfully!')
    }
  }
}

createVipGuestsTable().catch(console.error)
