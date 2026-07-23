ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log_admin_select" ON notification_log;
CREATE POLICY "notification_log_admin_select"
  ON notification_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['operaciones', 'admin', 'owner']));
