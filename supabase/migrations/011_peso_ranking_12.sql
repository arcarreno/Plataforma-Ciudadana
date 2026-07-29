-- Peso ranking 12: Concentración geográfica
-- Identifica solicitudes con 4+ peticiones en la misma calle
-- y coordenadas a <= 10 metros de distancia

CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 float8, lon1 float8,
  lat2 float8, lon2 float8
) RETURNS float8
  LANGUAGE plpgsql IMMUTABLE STRICT
  AS $$
DECLARE
  dlat float8;
  dlon float8;
  a float8;
  c float8;
  r float8 := 6371000;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2) ^ 2
     + cos(radians(lat1))
     * cos(radians(lat2))
     * sin(dlon / 2) ^ 2;
  c := 2 * asin(sqrt(a));
  RETURN r * c;
END;
$$;

CREATE OR REPLACE FUNCTION identificar_concentracion()
RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_ids bigint[];
  v_next bigint[];
  v_all bigint[];
  v_lat float8;
  v_lng float8;
  v_total int;
BEGIN
  IF NEW.peso_ranking = 15 THEN
    RETURN NEW;
  END IF;

  IF NEW.latitud IS NULL OR NEW.longitud IS NULL OR NULLIF(NEW.calle, '') IS NULL THEN
    RETURN NEW;
  END IF;

  v_lat := NEW.latitud::float8;
  v_lng := NEW.longitud::float8;
  v_ids := ARRAY[NEW.id_solicitud];
  v_next := ARRAY[NEW.id_solicitud];

  LOOP
    SELECT array_agg(DISTINCT s.id_solicitud)
    INTO v_next
    FROM solicitudes s
    WHERE s.calle = NEW.calle
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

  v_total := COALESCE(array_length(v_ids, 1), 0);

  IF v_total >= 4 THEN
    UPDATE solicitudes
    SET peso_ranking = 12
    WHERE id_solicitud = ANY (v_ids)
      AND peso_ranking != 15;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identificar_concentracion ON solicitudes;

CREATE TRIGGER trg_identificar_concentracion
  AFTER INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION identificar_concentracion();
