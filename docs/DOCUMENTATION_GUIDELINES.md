# Documentation Guidelines

## 📋 Structure de la Documentation

La documentation du projet est organisée de manière modulaire pour faciliter la maintenance et la navigation.

### Principe de Base

- **README.md** : Vue d'ensemble, quick start, liens vers la doc détaillée
- **docs/** : Documentation détaillée, organisée par thème

### Organisation des Fichiers

```
backend/
├── README.md                    # Vue d'ensemble + Quick Start
└── docs/
    ├── DOCUMENTATION_GUIDELINES.md  # Ce fichier (guide pour les contributeurs)
    ├── architecture.md          # Architecture du projet
    ├── database.md              # Schéma DB, Drizzle ORM, migrations
    ├── api.md                   # Endpoints API, conventions
    ├── mqtt.md                  # MQTT, buffering, temps réel
    ├── development.md           # Setup dev, scripts, debugging
    └── deployment.md            # Production, monitoring, performance
```

## ✍️ Règles d'Écriture

### README.md Principal

- **Objectif** : Permettre à un développeur de démarrer rapidement
- **Contenu** :
  - Description en 2-3 phrases
  - Tech stack (liste)
  - Installation (commandes essentielles)
  - Quick start (3-4 étapes max)
  - Liens vers docs/ pour les détails
- **Longueur** : Maximum 100 lignes
- **Ton** : Concis, orienté action

### Fichiers docs/

- **Objectif** : Documentation technique détaillée
- **Contenu** :
  - Explications approfondies
  - Exemples de code
  - Diagrammes si nécessaire
  - Bonnes pratiques
- **Longueur** : Pas de limite, mais rester focalisé sur le thème
- **Ton** : Pédagogique, précis

## 🎯 Quand Créer un Nouveau Fichier

Créer un nouveau fichier dans `docs/` quand :

- Le sujet dépasse 50 lignes
- Le sujet est autonome (peut être lu indépendamment)
- Le sujet nécessite des exemples de code détaillés

Exemples de sujets qui méritent leur propre fichier :

- Configuration d'un service (MQTT, Socket.IO)
- Guide de migration (ex: Drizzle ORM)
- Conventions de code spécifiques
- Troubleshooting guide

## 📝 Template de Fichier de Documentation

```markdown
# [Titre du Sujet]

> Résumé en une phrase de ce que couvre ce document

## Table des Matières

- [Section 1](#section-1)
- [Section 2](#section-2)

## Section 1

### Sous-section

Code example:
\`\`\`typescript
// Code here
\`\`\`

## Voir Aussi

- [Autre doc](./autre-doc.md)
- [README](../README.md)
```

## 🔄 Maintenance

### Mise à Jour de la Documentation

1. **Changement mineur** : Éditer directement le fichier concerné
2. **Nouveau feature** : Ajouter une section ou créer un nouveau fichier
3. **Refactoring majeur** : Mettre à jour tous les fichiers impactés + README

### Checklist Avant Commit

- [ ] README.md reste concis (< 100 lignes)
- [ ] Liens entre fichiers sont à jour
- [ ] Code examples sont testés
- [ ] Pas de duplication d'information

## 🤖 Pour les IA

Quand vous contribuez à la documentation :

1. **Lire** ce fichier en premier
2. **Respecter** la structure modulaire
3. **Garder** le README principal concis
4. **Créer** de nouveaux fichiers dans `docs/` pour les détails
5. **Linker** les fichiers entre eux pour la navigation
6. **Utiliser** des exemples de code concrets
7. **Éviter** la duplication d'information

### Exemple de Contribution

❌ **Mauvais** : Ajouter 50 lignes sur Drizzle ORM dans le README
✅ **Bon** : Créer `docs/database.md` et ajouter un lien dans le README

## 📚 Ressources

- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
