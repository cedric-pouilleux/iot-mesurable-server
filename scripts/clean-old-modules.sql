-- Script pour nettoyer les anciens modules de la base de données
-- Modules à supprimer: module-air-bootstrap, module-esp32-1

-- 1. Supprimer les configurations de capteurs
DELETE FROM sensor_config 
WHERE module_id IN ('module-air-bootstrap', 'module-esp32-1');

-- 2. Supprimer les statuts de capteurs
DELETE FROM sensor_status 
WHERE module_id IN ('module-air-bootstrap', 'module-esp32-1');

-- 3. Supprimer le hardware des devices
DELETE FROM device_hardware 
WHERE module_id IN ('module-air-bootstrap', 'module-esp32-1');

-- 4. Supprimer le status système des devices
DELETE FROM device_system_status 
WHERE module_id IN ('module-air-bootstrap', 'module-esp32-1');

-- 5. (OPTIONNEL) Supprimer les mesures historiques
-- ATTENTION: Cela supprime toutes les données de mesure de ces modules
-- Décommentez si vous voulez vraiment supprimer l'historique
-- DELETE FROM measurements 
-- WHERE module_id IN ('module-air-bootstrap', 'module-esp32-1');

-- 6. (OPTIONNEL) Supprimer les logs système liés à ces modules
-- ATTENTION: Cela supprime tous les logs de ces modules
-- Décommentez si vous voulez vraiment supprimer les logs
-- DELETE FROM system_logs 
-- WHERE details->>'moduleId' IN ('module-air-bootstrap', 'module-esp32-1');

-- Vérifier les résultats
SELECT 'Modules restants:' as info;
SELECT module_id, module_type, name FROM device_system_status ORDER BY module_id;
