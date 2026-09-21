# Mode "Robot Humain" — comment ça marche, et comment l'étendre

## Ce qui existe déjà

- `realtime/robotArena.js` : serveur Socket.IO générique. Un admin "passe en
  direct" pour un `gameId` donné ; le prochain joueur qui ouvre la page de ce
  jeu est automatiquement mis en relation 1-contre-1 avec cet admin au lieu
  de jouer contre l'IA locale. Ensuite, les deux sockets se relaient
  simplement des petits messages JSON (`robot:action`) — chaque jeu décide
  lui-même ce que ces messages veulent dire.
- `public/js/games/engine.js` expose `Arena.robotMode` :
  - `Arena.robotMode.active` (bool) : vrai si CE joueur vient d'être matché
    avec un admin en direct pour ce jeu précis. À vérifier **une seule fois**,
    au tout début de `window.startGame`.
  - `Arena.robotMode.send(type, payload)` : envoie un message à l'admin.
  - `Arena.robotMode.onAction(fn)` : reçoit les messages envoyés par l'admin.
- `views/games/play.ejs` fait la détection + le matching **avant** de lancer
  le compte à rebours, donc `Arena.robotMode.active` est déjà correct quand
  `startGame()` s'exécute — aucun jeu n'a besoin de gérer la connexion
  lui-même.
- `views/admin/play-as-robot.ejs` : panneau de contrôle admin, avec un bloc
  d'interface différent par jeu supporté (`#ctrl-<gameId>`).
- 3 jeux déjà câblés en exemple : `quickdraw.js`, `rockpaperbot.js`,
  `tictactoe.js`. Ce sont les meilleurs modèles à copier.

## Ajouter un 4ème jeu (ou un 40ème) : 4 étapes

Prenons `connect4.js` comme exemple.

**1. Déclarer le support côté admin**

Dans `routes/admin.js` :
```js
const ROBOT_READY_GAMES = ['quickdraw', 'rockpaperbot', 'tictactoe', 'connect4'];
```

**2. Remplacer la décision de l'IA par un message quand `Arena.robotMode.active`**

Dans `public/js/games/connect4.js`, repérez l'endroit où l'IA choisit son
coup (`robotMove()` / `getBestMove()`), et à la place :

```js
const live = Arena.robotMode.active;

if (live) {
  Arena.robotMode.onAction((type, payload) => {
    if (type === 'move' && canPlace(payload.col)) {
      // ... appliquer le coup de l'admin comme si c'était robotMove() ...
    }
  });
}

function drop(col) {
  // ... code existant pour poser le pion du joueur ...
  if (live) {
    Arena.robotMode.send('your-turn', { board }); // prévenir l'admin
  } else {
    setTimeout(robotMove, 600); // comportement IA inchangé
  }
}
```

Le principe est toujours le même : **le jeu ne change de comportement que
si `live` est vrai** ; sinon zéro changement par rapport à avant.

**3. Ajouter le bloc de contrôle admin**

Dans `views/admin/play-as-robot.ejs`, ajoutez un `<div id="ctrl-connect4" class="robot-ctrl" style="display:none">`
avec les boutons pertinents (ici, 7 colonnes), et dans le script en bas du
fichier, un `if (payload.type === 'your-turn' && GAME_ID === 'connect4') { ... }`
qui dessine le plateau reçu et envoie `socket.emit('robot:action', {type:'move', payload:{col}})`
au clic.

**4. Tester**

Deux onglets : un connecté en admin sur `/admin/play/connect4` (cliquer
"Passer en direct"), un autre (navigation privée, ou déconnecté) sur
`/games/connect4`. Le badge rouge "🔴 Un admin contrôle le robot en direct !"
doit apparaître pendant le compte à rebours du second onglet.

## Note sur la transparence

Le badge "🔴 Un admin contrôle le robot en direct !" côté joueur est un choix
délibéré du patch : prévenir le joueur qu'il affronte potentiellement un
humain plutôt que de le lui cacher silencieusement. Si vous préférez
reproduire l'effet "test de Turing" mentionné dans les notes originales du
projet, il suffit de supprimer l'appel à `showLiveBadge()` dans
`views/games/play.ejs` — mais gardez à l'esprit que faire croire à des
utilisateurs qu'ils jouent contre une IA alors qu'un humain les contrôle est
une forme de tromperie, même dans un contexte ludique ; à vous de trancher
selon votre contexte (mentions légales, CGU, etc.).

## Limites actuelles (assumées, pour rester simple)

- Un admin ne peut être en direct que sur **un seul jeu à la fois** (par
  onglet/socket).
- Un jeu "en direct" ne peut être occupé que par **un joueur à la fois** :
  si un deuxième joueur arrive pendant qu'une partie est en cours, il jouera
  simplement contre l'IA locale (comportement par défaut, rien ne casse).
- L'état "qui est en direct" vit en mémoire dans le process Node
  (`Map` dans `robotArena.js`). Si vous déployez plusieurs instances du
  serveur derrière un load balancer, il faudra soit du sticky-sessions au
  niveau du LB, soit un adapter Socket.IO partagé (ex. `@socket.io/redis-adapter`)
  pour que l'admin et le joueur finissent sur la même instance.
