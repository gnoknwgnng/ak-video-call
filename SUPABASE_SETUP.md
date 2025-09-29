# Supabase Setup

To set up the required tables in your Supabase project, run the following SQL commands in the Supabase SQL editor:

## Create the queues table

```sql
CREATE TABLE queues (
  id SERIAL PRIMARY KEY,
  socket_id TEXT NOT NULL,
  gender TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for better performance
CREATE INDEX idx_queues_gender ON queues(gender);
CREATE INDEX idx_queues_created_at ON queues(created_at);
```

## Create the users table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  socket_id TEXT UNIQUE NOT NULL,
  gender TEXT NOT NULL,
  partner_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_socket_id ON users(socket_id);
CREATE INDEX idx_users_partner_id ON users(partner_id);
```

## Enable Realtime (Optional)

To enable realtime capabilities for the tables:

```sql
-- Enable realtime for queues table
BEGIN;
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE queues;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
COMMIT;
```

After creating these tables, your application should work correctly with Supabase for storing user queues and connection information.