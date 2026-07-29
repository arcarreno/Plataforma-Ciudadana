-- Retorna todo el cluster de concentración (BFS como el trigger)
CREATE OR REPLACE FUNCTION obtener_concentracion_vecinos(p_id_solicitud bigint)
RETURNS TABLE(id_solicitud bigint, folio_unico text, distancia_m float8)
  LANGUAGE plpgsql STABLE
  AS $$
DECLARE
  v_calle text;
  v_origin_lat float8;
  v_origin_lng float8;
  v_ids bigint[];
  v_next bigint[];
BEGIN
  SELECT calle, latitud::float8, longitud::float8
  INTO v_calle, v_origin_lat, v_origin_lng
  FROM solicitudes
  WHERE id_solicitud = p_id_solicitud;

  IF v_calle IS NULL OR v_origin_lat IS NULL OR v_origin_lng IS NULL THEN
    RETURN;
  END IF;

  v_ids := ARRAY[p_id_solicitud];
  v_next := ARRAY[p_id_solicitud];

  LOOP
    SELECT array_agg(DISTINCT s.id_solicitud)
    INTO v_next
    FROM solicitudes s
    WHERE s.calle = v_calle
      AND s.peso_ranking != 15
      AND s.latitud IS NOT NULL AND s.longitud IS NOT NULL
      AND s.id_solicitud <> ALL (v_ids)
      AND EXISTS (
        SELECT 1
        FROM unnest(v_next) AS nid
        INNER JOIN solicitudes sn ON sn.id_solicitud = nid
        WHERE haversine_distance(
          s.latitud::float8, s.longitud::float8,
          sn.latitud::float8, sn.longitud::float8
        ) <= 10
      );

    IF v_next IS NULL THEN
      EXIT;
    END IF;

    v_ids := v_ids || v_next;
  END LOOP;

  RETURN QUERY
  SELECT s.id_solicitud, s.folio_unico,
    round(haversine_distance(v_origin_lat, v_origin_lng, s.latitud::float8, s.longitud::float8)::numeric, 1)::float8
  FROM solicitudes s
  WHERE s.id_solicitud = ANY (v_ids)
    AND s.id_solicitud != p_id_solicitud
  ORDER BY s.folio_unico;
END;
$$;
