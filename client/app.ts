import { Texture, Application, Sprite, AnimatedSprite, TilingSprite } from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerState, Orientation } from "./.rtag/types";
import { Entity } from "./Entity";

const BUFFER_TIME = 140;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

type EntityId = string | number;
const client = new RtagClient(import.meta.env.VITE_APP_ID);
const entities: Map<EntityId, { entity: Entity; sprite: Sprite }> = new Map();
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
  const connection = await getClient(sessionStorage.getItem("token")!, (state) => {
    const updatedEntites: Set<EntityId> = new Set();
    function handleEntity(id: EntityId, x: number, y: number, angle: number, spriteGenerator: () => Sprite) {
      updatedEntites.add(id);
      if (!entities.has(id)) {
        const sprite = spriteGenerator();
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, { entity: new Entity({ x, y }, angle), sprite });
      } else {
        entities.get(id)!.entity.updateTarget({ x, y }, angle, state.updatedAt + BUFFER_TIME);
      }
    }
    state.ships.forEach(({ player, x, y, angle, hitCount }) => {
      handleEntity(player, x, y, angle, () => new AnimatedSprite(shipTextures));
      (entities.get(player)!.sprite as AnimatedSprite).gotoAndStop(hitCount);
    });
    state.cannonBalls.forEach(({ id, x, y }) => handleEntity(id, x, y, 0, () => new Sprite(cannonBallTexure)));
    for (const entityId of entities.keys()) {
      if (!updatedEntites.has(entityId)) {
        entities.get(entityId)!.sprite.destroy();
        entities.delete(entityId);
      }
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
    const now = Date.now();
    entities.forEach(({ entity, sprite }) => {
      const { location, angle } = entity.getCurrPos(now);
      sprite.rotation = angle - Math.PI / 2;
      sprite.x = location.x;
      sprite.y = location.y;
    });
  });

  return app.view;
}

async function getClient(token: string, onStateChange: (state: PlayerState) => void) {
  if (location.pathname.length > 1) {
    const connection = await client.connectExisting(token, location.pathname.split("/").pop()!, onStateChange);
    connection.joinGame({});
    return connection;
  } else {
    const connection = await client.connectNew(token, {}, onStateChange);
    history.pushState({}, "", `/${connection.stateId}`);
    return connection;
  }
}
