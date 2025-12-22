-- Script de nettoyage des valeurs aberrantes dans la table measurements
-- Exécuter ce script sur la base de données de production

BEGIN;

-- Afficher les valeurs aberrantes avant suppression (pour audit)
SELECT 'Valeurs aberrantes à supprimer:' as action;

SELECT sensor_type, COUNT(*) as count, MIN(value) as min_value, MAX(value) as max_value
FROM measurements
WHERE 
  (sensor_type = 'pressure' AND (value < 300 OR value > 1200))
  OR (sensor_type = 'temperature_bmp' AND (value < -40 OR value > 85))
  OR (sensor_type = 'temperature' AND (value < -40 OR value > 85))
  OR (sensor_type = 'humidity' AND (value < 0 OR value > 100))
  OR (sensor_type = 'co2' AND (value < 0 OR value > 10000))
  OR (sensor_type = 'voc' AND (value < 0 OR value > 500))
GROUP BY sensor_type
ORDER BY sensor_type;

-- Supprimer les valeurs de pression aberrantes (hors plage 300-1200 hPa)
DELETE FROM measurements 
WHERE sensor_type = 'pressure' AND (value < 300 OR value > 1200);

-- Supprimer les valeurs de température BMP aberrantes (hors plage -40 à 85°C)
DELETE FROM measurements 
WHERE sensor_type = 'temperature_bmp' AND (value < -40 OR value > 85);

-- Supprimer les valeurs de température DHT aberrantes (hors plage -40 à 85°C)
DELETE FROM measurements 
WHERE sensor_type = 'temperature' AND (value < -40 OR value > 85);

-- Supprimer les valeurs d'humidité aberrantes (hors plage 0-100%)
DELETE FROM measurements 
WHERE sensor_type = 'humidity' AND (value < 0 OR value > 100);

-- Supprimer les valeurs de CO2 aberrantes (hors plage 0-10000 ppm)
DELETE FROM measurements 
WHERE sensor_type = 'co2' AND (value < 0 OR value > 10000);

-- Supprimer les valeurs de VOC aberrantes (hors plage 0-500)
DELETE FROM measurements 
WHERE sensor_type = 'voc' AND (value < 0 OR value > 500);

-- Vérifier qu'il ne reste plus de valeurs aberrantes
SELECT 'Vérification post-nettoyage:' as action;

SELECT sensor_type, COUNT(*) as count, MIN(value) as min_value, MAX(value) as max_value
FROM measurements
WHERE 
  (sensor_type = 'pressure' AND (value < 300 OR value > 1200))
  OR (sensor_type = 'temperature_bmp' AND (value < -40 OR value > 85))
  OR (sensor_type = 'temperature' AND (value < -40 OR value > 85))
  OR (sensor_type = 'humidity' AND (value < 0 OR value > 100))
  OR (sensor_type = 'co2' AND (value < 0 OR value > 10000))
  OR (sensor_type = 'voc' AND (value < 0 OR value > 500))
GROUP BY sensor_type;

-- Afficher le résumé des données restantes
SELECT 'Données restantes par capteur:' as action;

SELECT sensor_type, COUNT(*) as count, MIN(value) as min_value, MAX(value) as max_value
FROM measurements
GROUP BY sensor_type
ORDER BY sensor_type;

COMMIT;

SELECT '✅ Nettoyage terminé avec succès!' as status;
