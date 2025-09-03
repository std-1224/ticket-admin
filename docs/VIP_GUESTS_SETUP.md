# VIP Guests Feature Setup Guide

## Overview
The VIP Guests feature allows administrators to manage special invitations for VIP attendees. This includes creating VIP invitations, tracking their status, and managing QR codes for exclusive access.

## Features Implemented

### 1. VIP Guests Page (`/vip-guests`)
- **Location**: `ticket-admin/app/vip-guests/page.tsx`
- **Component**: `ticket-admin/components/pages/vip-guests-page.tsx`
- **Navigation**: Added to both desktop sidebar and mobile bottom navigation

### 2. Core Functionality
- ✅ **Add New VIP Guests**: Modal form with name, email, event selection, and notes
- ✅ **View VIP Guest List**: Table with guest details, status, and actions
- ✅ **Status Management**: Track invited, confirmed, and cancelled statuses
- ✅ **Search & Filter**: Search by name/email and filter by event
- ✅ **Statistics Dashboard**: Cards showing total, confirmed, invited, and cancelled VIPs
- ✅ **QR Code Generation**: Automatic QR code generation for each VIP guest
- ✅ **Actions Menu**: Send QR code, view details, and status management

### 3. Database Schema
The VIP guests feature requires a new database table. Here's the SQL to create it:

```sql
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
```

## Setup Instructions

### 1. Database Setup
1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the SQL schema provided above
4. Verify the table was created successfully

### 2. Navigation Setup
The navigation has been automatically configured:
- ✅ Desktop sidebar: VIP Guests menu item with star icon
- ✅ Mobile navigation: VIP item in bottom navigation
- ✅ Routing: `/vip-guests` route configured

### 3. Permissions
The VIP Guests feature is restricted to admin users only. Make sure your user has the 'admin' role.

## File Structure

```
ticket-admin/
├── app/vip-guests/
│   └── page.tsx                          # Route page
├── components/pages/
│   └── vip-guests-page.tsx              # Main VIP guests component
├── components/
│   ├── app-sidebar.tsx                  # Updated with VIP Guests menu
│   ├── mobile-bottom-nav.tsx            # Updated with VIP navigation
│   └── shared-layout.tsx                # Updated with VIP routing
├── supabase/migrations/
│   └── 20240103000000_create_vip_guests_table.sql
├── scripts/
│   └── create-vip-table.js              # Helper script to check table
└── docs/
    └── VIP_GUESTS_SETUP.md              # This documentation
```

## Usage Guide

### Adding a VIP Guest
1. Navigate to `/vip-guests`
2. Click "Add VIP" button
3. Fill in the form:
   - **Full Name**: Complete name of the VIP guest
   - **Email**: Contact email address
   - **Select Event**: Choose from available events
   - **Notes**: Optional additional information
4. Click "Add VIP" to save

### Managing VIP Guests
- **Search**: Use the search bar to find guests by name or email
- **Filter**: Select specific events from the dropdown
- **Status Updates**: Use the actions menu to change guest status
- **Send QR**: Simulate sending QR codes to guests (currently simulated)

### Status Types
- **Invited**: Initial status when VIP is added
- **Confirmed**: Guest has confirmed attendance
- **Cancelled**: Guest cannot attend or invitation revoked

## Design Features

### UI Components Used
- **Cards**: Statistics dashboard and main content
- **Table**: VIP guest list with sorting
- **Modal Dialog**: Add new VIP guest form
- **Dropdown Menus**: Actions and filters
- **Badges**: Status indicators with colors
- **Search Input**: Real-time search functionality
- **Avatar**: Guest profile pictures (initials)

### Theme Consistency
- ✅ Dark theme support
- ✅ Consistent with existing admin panel design
- ✅ Responsive design for mobile and desktop
- ✅ Proper spacing and typography
- ✅ Icon consistency (Star icon for VIP theme)

## Future Enhancements

### Planned Features
- [ ] **Email Integration**: Real QR code sending via email
- [ ] **Guest Details Modal**: Detailed view of VIP guest information
- [ ] **Bulk Actions**: Select multiple guests for batch operations
- [ ] **Export Functionality**: Export VIP guest lists
- [ ] **QR Code Scanner Integration**: Validate VIP QR codes
- [ ] **Event-specific VIP Management**: Enhanced event filtering
- [ ] **VIP Guest Check-in**: Special check-in process for VIPs

### Technical Improvements
- [ ] **Real-time Updates**: WebSocket integration for live updates
- [ ] **Advanced Search**: Full-text search with filters
- [ ] **Pagination**: Handle large numbers of VIP guests
- [ ] **Audit Trail**: Track changes to VIP guest records
- [ ] **Role-based Permissions**: Granular access control

## Troubleshooting

### Common Issues

1. **Table Not Found Error**
   - Ensure the VIP guests table has been created in Supabase
   - Run the SQL schema provided above

2. **Navigation Not Showing**
   - Verify user has 'admin' role
   - Check that the navigation components have been updated

3. **Form Submission Errors**
   - Check Supabase connection and permissions
   - Verify all required fields are filled

### Support
For additional support or feature requests, please refer to the main project documentation or contact the development team.
