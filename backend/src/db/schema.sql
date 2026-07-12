-- AssetFlow Database Schema
-- Minimum PostgreSQL 14+ (UUID and JSONB support, gen_random_uuid())

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Drop tables if they exist (for clean migrations)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_records CASCADE;
DROP TABLE IF EXISTS audit_auditors CASCADE;
DROP TABLE IF EXISTS audit_cycles CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS resource_bookings CASCADE;
DROP TABLE IF EXISTS transfer_requests CASCADE;
DROP TABLE IF EXISTS asset_allocations CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS asset_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 1. Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    head_id UUID, -- circular ref to users, added constraint later
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add head_id constraint to departments table now that users table is created
ALTER TABLE departments 
ADD CONSTRAINT fk_departments_head 
FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Asset Categories table
CREATE TABLE asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb NOT NULL, -- schema for dynamic properties
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4b. Locations table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Assets table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
    asset_tag VARCHAR(50) UNIQUE NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    acquisition_date DATE NOT NULL,
    acquisition_cost NUMERIC(15, 2) NOT NULL CHECK (acquisition_cost >= 0),
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('New', 'Good', 'Fair', 'Poor')),
    location VARCHAR(100) NOT NULL,
    photo_url VARCHAR(255),
    is_shared_bookable BOOLEAN DEFAULT FALSE NOT NULL,
    status VARCHAR(30) DEFAULT 'AVAILABLE' NOT NULL 
        CHECK (status IN ('AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    current_holder_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category_fields JSONB DEFAULT '{}'::jsonb NOT NULL, -- actual custom values
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6. Asset Allocations table
CREATE TABLE asset_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    allocated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expected_return_at TIMESTAMP WITH TIME ZONE,
    returned_at TIMESTAMP WITH TIME ZONE,
    check_in_notes TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Enforce either user allocation or department allocation, not both
    CONSTRAINT check_allocation_target CHECK (
        (user_id IS NOT NULL AND department_id IS NULL) OR 
        (user_id IS NULL AND department_id IS NOT NULL)
    ),
    -- Verify expected return is in future compared to allocation
    CONSTRAINT check_allocation_dates CHECK (expected_return_at IS NULL OR expected_return_at > allocated_at)
);

-- 7. Transfer Requests table
CREATE TABLE transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    from_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    from_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    to_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    to_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    approval_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Enforce valid to targets
    CONSTRAINT check_transfer_to_target CHECK (
        (to_user_id IS NOT NULL AND to_department_id IS NULL) OR 
        (to_user_id IS NULL AND to_department_id IS NOT NULL)
    ),
    -- Prevent self transfers
    CONSTRAINT check_not_self_transfer CHECK (
        (from_user_id IS DISTINCT FROM to_user_id) OR
        (from_department_id IS DISTINCT FROM to_department_id)
    )
);

-- 8. Resource Bookings table (with GIST exclusion constraint for overlapping slots)
CREATE TABLE resource_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    booked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    booked_for_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'UPCOMING' NOT NULL CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_booking_dates CHECK (start_time < end_time)
);

-- GIST exclusion constraint to prevent overlapping bookings for ACTIVE (Upcoming/Ongoing) bookings.
-- Requires btree_gist extension.
ALTER TABLE resource_bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status IN ('UPCOMING', 'ONGOING'));

-- 9. Maintenance Requests table
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    raised_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) DEFAULT 'PENDING' NOT NULL 
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED')),
    technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    photo_url VARCHAR(255),
    cost NUMERIC(15, 2) CHECK (cost >= 0),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 10. Audit Cycles table
CREATE TABLE audit_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    scope_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    scope_location VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED' NOT NULL CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_audit_dates CHECK (start_date <= end_date)
);

-- 11. Audit Auditors (junction table)
CREATE TABLE audit_auditors (
    audit_cycle_id UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
    auditor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (audit_cycle_id, auditor_id)
);

-- 12. Audit Records table
CREATE TABLE audit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    auditor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('VERIFIED', 'MISSING', 'DAMAGED')),
    notes TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_audit_asset UNIQUE (audit_cycle_id, asset_id)
);

-- 13. Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ASSET_ASSIGNED', 'BOOKING_CONFIRMED', 'BOOKING_REMINDER', 
        'TRANSFER_APPROVED', 'MAINTENANCE_APPROVED', 'AUDIT_FLAG', 
        'OVERDUE_RETURN', 'SYSTEM'
    )),
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    reference_entity_type VARCHAR(50), -- e.g. 'assets', 'resource_bookings', 'maintenance_requests'
    reference_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 14. Activity Logs table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable for system tasks or pre-login
    action VARCHAR(100) NOT NULL,
    target_table VARCHAR(50),
    target_id UUID,
    previous_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

---------------------------------------------------------
-- INDEXES FOR PERFORMANCE OPTIMIZATION
---------------------------------------------------------
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_assets_tag ON assets(asset_tag);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_holder ON assets(current_holder_id);
CREATE INDEX idx_allocations_active ON asset_allocations(asset_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_bookings_range ON resource_bookings(asset_id, start_time, end_time);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_audit_records_cycle ON audit_records(audit_cycle_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_logs_timestamp ON activity_logs(timestamp DESC);

---------------------------------------------------------
-- PL/PGSQL TRIGGERS FOR BUSINESS RULES
---------------------------------------------------------

-- 1. Trigger for Maintenance requests status transitions
CREATE OR REPLACE FUNCTION trg_handle_maintenance_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Transition to APPROVED: Mark asset as UNDER_MAINTENANCE
    IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
        UPDATE assets 
        SET status = 'UNDER_MAINTENANCE', updated_at = NOW() 
        WHERE id = NEW.asset_id;
    
    -- Transition to RESOLVED: Return asset to AVAILABLE
    ELSIF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        UPDATE assets 
        SET status = 'AVAILABLE', updated_at = NOW() 
        WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintenance_status_trigger
AFTER UPDATE OF status ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION trg_handle_maintenance_status_change();

-- 2. Trigger for Audit Cycle closure (COMPLETED)
CREATE OR REPLACE FUNCTION trg_handle_audit_cycle_closure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        -- 1. Assets marked MISSING become LOST
        UPDATE assets
        SET status = 'LOST', updated_at = NOW()
        WHERE id IN (
            SELECT asset_id 
            FROM audit_records 
            WHERE audit_cycle_id = NEW.id AND status = 'MISSING'
        );

        -- 2. Assets marked DAMAGED have condition set to 'Poor'
        UPDATE assets
        SET condition = 'Poor', updated_at = NOW()
        WHERE id IN (
            SELECT asset_id 
            FROM audit_records 
            WHERE audit_cycle_id = NEW.id AND status = 'DAMAGED'
        );

        -- 3. Automatically spawn a HIGH priority Maintenance Request for DAMAGED assets
        INSERT INTO maintenance_requests (asset_id, raised_by, description, priority, status)
        SELECT 
            ar.asset_id, 
            ar.auditor_id, 
            'Audit Cycle (' || NEW.name || ') Flagged: Asset is Damaged. ' || COALESCE(ar.notes, ''), 
            'HIGH', 
            'PENDING'
        FROM audit_records ar
        WHERE ar.audit_cycle_id = NEW.id AND ar.status = 'DAMAGED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_cycle_closure_trigger
AFTER UPDATE OF status ON audit_cycles
FOR EACH ROW
EXECUTE FUNCTION trg_handle_audit_cycle_closure();

-- 3. Trigger for updating updated_at columns
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_departments_timestamp BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_assets_timestamp BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_allocations_timestamp BEFORE UPDATE ON asset_allocations FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_transfers_timestamp BEFORE UPDATE ON transfer_requests FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_bookings_timestamp BEFORE UPDATE ON resource_bookings FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_maintenance_timestamp BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER update_audit_cycles_timestamp BEFORE UPDATE ON audit_cycles FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
