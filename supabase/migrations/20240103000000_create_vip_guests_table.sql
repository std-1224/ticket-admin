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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vip_guests_updated_at 
    BEFORE UPDATE ON vip_guests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
INSERT INTO vip_guests (name, email, event_id, status, qr_code, notes) VALUES
('Flavia Rodriguez', 'flavia@example.com', (SELECT id FROM events LIMIT 1), 'invited', 'VIP-1704240000-abc123def', 'Special guest speaker'),
('Carlos Gomez', 'carlos@example.com', (SELECT id FROM events LIMIT 1), 'confirmed', 'VIP-1704240001-def456ghi', 'VIP sponsor'),
('Laura Fernandez', 'laura@example.com', (SELECT id FROM events LIMIT 1), 'invited', 'VIP-1704240002-ghi789jkl', 'Media representative')
ON CONFLICT (qr_code) DO NOTHING;
