import { Texture, Application, Sprite, TilingSprite } from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerState, Point, Rotation } from "./.rtag/types";
import { Entity } from "./Entity";

const BUFFER_TIME = 140;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

const client = new RtagClient(import.meta.env.VITE_APP_ID);
const entities: Map<string, { entity: Entity; sprite: Sprite }> = new Map();
const waterTexture = Texture.from("water.png");
const shipTexture = Texture.from("ship.png");
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
    const updatedEntites: Set<string> = new Set();
    function handleEntity(id: string, location: Point, angle: number, texture: Texture) {
      updatedEntites.add(id);
      if (!entities.has(id)) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, { entity: new Entity(location, angle), sprite });
      } else {
        entities.get(id)!.entity.updateTarget(location, angle, state.updatedAt + BUFFER_TIME);
      }
    }
    state.ships.forEach(({ player, location, angle }) => handleEntity(player, location, angle, shipTexture));
    state.cannonBalls.forEach(({ id, location }) => handleEntity(id, location, 0, cannonBallTexure));
    for (const entityId of entities.keys()) {
      if (!updatedEntites.has(entityId)) {
        entities.get(entityId)!.sprite.destroy();
        entities.delete(entityId);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      connection.setRotation({ rotation: Rotation.RIGHT });
    } else if (e.key === "ArrowLeft") {
      connection.setRotation({ rotation: Rotation.LEFT });
    } else if (e.key === "ArrowUp") {
      connection.setRotation({ rotation: Rotation.FORWARD });
    } else if (e.key === " ") {
      connection.fireCannon({});
    }
  });

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
    const stateId = location.pathname.split("/").pop()!;
    return client.connectExisting(token, stateId, onStateChange);
  } else {
    const connection = await client.connectNew(token, {}, onStateChange);
    history.pushState({}, "", `/${connection.stateId}`);
    return connection;
  }
}
