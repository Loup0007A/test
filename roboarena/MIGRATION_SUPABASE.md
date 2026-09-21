# Migration vers Supabase (Postgres)

RoboArena stockait tout dans un fichier JSON local (`data/db.json` via
LowDB). Ce n'est pas viable sur la plupart des hébergeurs modernes (Render,
Railway, Fly...) car le disque n'est pas persistant entre les déploiements.
`models/db.js` parle maintenant directement à Postgres via le module `pg`.

## 1. Créer le projet Supabase

Rien de spécial ici, un projet Supabase standard suffit — on n'utilise que
la base Postgres sous-jacente, pas l'API Data/Auth de Supabase.

## 2. Récupérer la bonne chaîne de connexion : le **Session Pooler**

Dans le dashboard Supabase : **Project Settings → Database → Connection
string**, il y a plusieurs onglets :

| Onglet | Port | À utiliser ici ? |
|---|---|---|
| Direct connection | 5432 | ❌ IPv6 seulement (sauf add-on IPv4 payant) |
| **Session pooler** | **5432** | ✅ **C'est celui-ci** |
| Transaction pooler | 6543 | ❌ Casse les requêtes préparées de `pg` |

Pourquoi le *session* pooler et pas le *transaction* pooler : le module
`pg` envoie ses requêtes paramétrées (`pool.query(text, values)`) via le
protocole étendu de Postgres, qui utilise des "prepared statements" côté
connexion. Le pooler en mode **transaction** (PgBouncer) casse ce
mécanisme parce qu'il peut faire changer de connexion physique entre deux
requêtes du même client logique. Le pooler en mode **session** garde une
connexion dédiée le temps de la session applicative, donc tout fonctionne
normalement — c'est aussi le mode compatible IPv4, ce qui correspond à ce
qui était demandé.

La chaîne ressemble à :
```
postgresql://postgres.<project-ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Collez-la dans `.env` sous `DATABASE_URL` (voir `.env.example`).

## 3. Créer le schéma

Deux options, au choix :

- **Automatique** : rien à faire, `models/db.js` exécute des
  `CREATE TABLE IF NOT EXISTS` au démarrage du serveur.
- **Manuel / CI** : `npm run db:schema` exécute `db/schema.sql` une fois
  (utile si le rôle applicatif n'a pas le droit de créer l'extension
  `pgcrypto` tout seul — dans ce cas lancez `db/schema.sql` depuis
  l'éditeur SQL de Supabase avec le rôle `postgres`).

## 4. Variables d'environnement

```env
DATABASE_URL=postgresql://postgres.xxxx:motdepasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DATABASE_POOL_MAX=10
```

`DATABASE_POOL_MAX` : le pooler Supabase a lui-même une limite de connexions
selon votre plan. `10` est une valeur raisonnable pour une seule instance
Node ; si vous scalez à plusieurs instances (plusieurs dynos/pods), baissez
cette valeur pour rester sous la limite globale du pooler.

## 5. Row Level Security (RLS)

Le dashboard Supabase va probablement afficher un avertissement "RLS
disabled" sur ces tables. C'est normal et sans risque **dans ce contexte** :
le serveur Express se connecte directement à Postgres avec un rôle
applicatif, pas via l'API PostgREST/Data API de Supabase (qui, elle,
respecte RLS et pour laquelle RLS est indispensable). Si un jour vous
exposez ces tables via `supabase-js` côté navigateur, activez RLS et
écrivez des policies avant de le faire — pas avant.

## 6. Ce qui change pour vous, développeur

Toutes les méthodes de `Users`/`Scores`/`Logs` sont maintenant asynchrones :

```js
// Avant (LowDB, synchrone)
const user = Users.findByUsername('alice');

// Après (Postgres, asynchrone)
const user = await Users.findByUsername('alice');
```

Tous les appels existants dans les routes ont déjà été mis à jour dans ce
patch. Si vous ajoutez de nouvelles routes qui touchent la base, pensez à
`await` + `async function(req, res, next) { try { ... } catch (err) { next(err); } }`.
