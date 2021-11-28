import { Texture, Application, Sprite, AnimatedSprite, TilingSprite } from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerState, Orientation } from "./.rtag/types";
import { StateBuffer } from "./stateBuffer";

const BUFFER_TIME = 140;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

type EntityId = string | number;
const client = new RtagClient(import.meta.env.VITE_APP_ID);
const entities: Map<EntityId, Sprite> = new Map();
const waterTexture = Texture.from("water.png");
const shipTextures = [...Array(4)].map((_, i) => Texture.from(`ship${i}.png`));
const cannonBallTexure = Texture.from("cannonBall.png");

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  const app = new Application({ width: MAP_WIDTH, height: MAP_HEIGHT });
  const background = new TilingSprite(waterTexture, app.view.width, app.view.width);
  app.stage.addChild(background);

  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await client.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;
  const user = RtagClient.getUserFromToken(token);
  let buffer: StateBuffer | undefined;
  const connection = await getClient(token, (state) => {
    if (state.ships.find((ship) => ship.player === user.name) === undefined) {
      connection.joinGame({});
    }
    if (buffer === undefined) {
      buffer = new StateBuffer(state);
    } else {
      buffer.enqueue({ ...state, updatedAt: state.updatedAt + BUFFER_TIME });
    }
  });

  const keysDown: Set<string> = new Set();
  function handleKeyEvt(e: KeyboardEvent) {
    if (e.key === " " && e.type === "keydown") {
      connection.fireCannon({});
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
      return;
    }
    if (e.type === "keydown") {
      if (keysDown.has(e.key)) {
        return;
      }
      keysDown.add(e.key);
    } else if (e.type === "keyup") {
      keysDown.delete(e.key);
    }
    const orientation = keysDown.has("ArrowLeft")
      ? Orientation.LEFT
      : keysDown.has("ArrowRight")
      ? Orientation.RIGHT
      : Orientation.FORWARD;
    connection.setOrientation({ orientation, accelerating: keysDown.has("ArrowUp") });
  }
  document.addEventListener("keydown", handleKeyEvt);
  document.addEventListener("keyup", handleKeyEvt);

  app.ticker.add(() => {
    if (buffer === undefined) {
      return;
    }
    const state = buffer.getInterpolatedState(Date.now());
    const updatedEntites: Set<EntityId> = new Set();
    function handleEntity(id: EntityId, x: number, y: number, angle: number, spriteGenerator: () => Sprite) {
      updatedEntites.add(id);
      if (!entities.has(id)) {
        const sprite = spriteGenerator();
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, sprite);
      } else {
        const sprite = entities.get(id)!;
        sprite.rotation = angle - Math.PI / 2;
        sprite.x = x;
        sprite.y = y;
      }
    }
    state.ships.forEach(({ player, x, y, angle, hitCount }) => {
      handleEntity(player, x, y, angle, () => new AnimatedSprite(shipTextures));
      (entities.get(player)! as AnimatedSprite).gotoAndStop(hitCount);
    });
    state.cannonBalls.forEach(({ id, x, y }) => handleEntity(id, x, y, 0, () => new Sprite(cannonBallTexure)));
    for (const entityId of entities.keys()) {
      if (!updatedEntites.has(entityId)) {
        entities.get(entityId)!.destroy();
        entities.delete(entityId);
      }
    }
  });

  return app.view;
}

async function getClient(token: string, onStateChange: (state: PlayerState) => void) {
  if (location.pathname.length > 1) {
    return client.connectExisting(token, location.pathname.split("/").pop()!, onStateChange);
  } else {
    const connection = await client.connectNew(token, {}, onStateChange);
    history.pushState({}, "", `/${connection.stateId}`);
    return connection;
  }
}
