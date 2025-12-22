-- Script pour vérifier les données de pressure en base
-- Usage: psql -U postgres -d iot_db -f scripts/check-pressure-data.sql

-- 1. Compter le nombre total de mesures de pressure
SELECT 
    'Total pressure measurements' as metric,
    COUNT(*) as count
FROM measurements
WHERE sensor_type = 'pressure';

-- 2. Compter par module
SELECT 
    module_id,
    COUNT(*) as count,
    MIN(time) as first_measurement,
    MAX(time) as last_measurement,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value
FROM measurements
WHERE sensor_type = 'pressure'
GROUP BY module_id
ORDER BY count DESC;

-- 3. Dernières 10 mesures de pressure
SELECT 
    time,
    module_id,
    value,
    ROUND(value::numeric, 2) as value_rounded
FROM measurements
WHERE sensor_type = 'pressure'
ORDER BY time DESC
LIMIT 10;

-- 4. Vérifier aussi dans sensor_status (valeur actuelle)
SELECT 
    module_id,
    value,
    updated_at
FROM sensor_status
WHERE sensor_type = 'pressure';

-- 5. Comparer avec les autres capteurs pour voir la distribution
SELECT 
    sensor_type,
    COUNT(*) as count,
    COUNT(DISTINCT module_id) as module_count
FROM measurements
GROUP BY sensor_type
ORDER BY count DESC;


