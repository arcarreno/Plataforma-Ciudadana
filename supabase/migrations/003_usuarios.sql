CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'revisor')),
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO usuarios (username, password_hash, rol)
VALUES ('ArmandoCarr12', crypt('Armando122432.', gen_salt('bf')), 'admin');

CREATE OR REPLACE FUNCTION login_usuario(p_username TEXT, p_password TEXT)
RETURNS TABLE (v_id BIGINT, v_username TEXT, v_rol TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.rol
  FROM usuarios u
  WHERE u.username = p_username
    AND u.password_hash = crypt(p_password, u.password_hash)
    AND u.activo = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION crear_usuario(
  p_admin_id BIGINT,
  p_username TEXT,
  p_password TEXT,
  p_rol TEXT
) RETURNS TEXT AS $$
DECLARE
  v_admin_rol TEXT;
BEGIN
  SELECT rol INTO v_admin_rol FROM usuarios WHERE id = p_admin_id;
  IF v_admin_rol IS NULL OR v_admin_rol != 'admin' THEN
    RETURN 'error: solo administradores pueden crear usuarios';
  END IF;

  INSERT INTO usuarios (username, password_hash, rol)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_rol);

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
