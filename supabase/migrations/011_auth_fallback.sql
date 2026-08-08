-- 011_auth_fallbak.sql
-- Login de respaldo: permite autenticarse contra la tabla usuarios de Supabase
-- cuando el servidor local (10.4.3.154) no está disponible.
--
-- Nota: los hashes bcrypt generados por Python (`$2b$`) no son aceptados
-- directamente por pgcrypto (solo `$2a$`). El $2b$ es 100% compatible en contenido,
-- por eso solo se reescribe el prefijo del hash ANTES de comparar (nunca se modifica
-- el dato almacenado).
--
-- Seguridad: SECURITY DEFINER -> la función corre con permisos del dueño (postgres)
-- y NO expone password_hash; solo devuelve los campos de sesión si la contraseña coincide.

create or replace function public.login_operador(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.usuarios%rowtype;
  v_hash text;
begin
  select * into v_user
  from public.usuarios
  where username = lower(btrim(p_username));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'credenciales');
  end if;

  -- Normalizar prefijo $2b$ -> $2a$ (bcrypt de Python vs pgcrypto)
  v_hash := replace(v_user.password_hash, '$2b$', '$2a$');

  if not coalesce(v_user.activo, true) then
    return jsonb_build_object('ok', false, 'error', 'inactivo');
  end if;

  if extensions.crypt(p_password, v_hash) = v_hash then
    return jsonb_build_object(
      'ok', true,
      'id', v_user.id,
      'username', v_user.username,
      'rol', v_user.rol,
      'nombres', v_user.nombres,
      'apellidos', v_user.apellidos
    );
  end if;

  return jsonb_build_object('ok', false, 'error', 'credenciales');
end;
$$;

revoke all on function public.login_operador(text, text) from public;
grant execute on function public.login_operador(text, text) to anon, authenticated;

-- Listado de operadores (solo lectura admin; sin password_hash)
create or replace function public.listar_operadores()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'rol', u.rol,
      'nombres', coalesce(u.nombres, ''),
      'apellidos', coalesce(u.apellidos, ''),
      'activo', u.activo
    ) order by u.id
  )
  into v_resultado
  from public.usuarios u;

  return coalesce(v_resultado, '[]'::jsonb);
end;
$$;

revoke all on function public.listar_operadores() from public;
grant execute on function public.listar_operadores() to anon, authenticated;