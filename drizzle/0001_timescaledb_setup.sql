-- Configuration TimescaleDB pour la table measurements
-- À exécuter APRÈS la création de la table measurements

-- Convertir measurements en hypertable TimescaleDB
-- Note: Cette commande échouera si l'hypertable existe déjà, c'est normal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'measurements'
    ) THEN
        PERFORM create_hypertable('measurements', 'time');
        RAISE NOTICE 'Hypertable measurements créée avec succès';
    ELSE
        RAISE NOTICE 'Hypertable measurements existe déjà';
    END IF;
END $$;







