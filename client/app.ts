import * as PIXI from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { EntityType, PlayerState } from "./.rtag/types";
import { Entity } from "./Entity";

const BUFFER_TIME = 140;

const client = new RtagClient(import.meta.env.VITE_APP_ID);

const entities: Map<string, { entity: Entity; sprite: PIXI.Sprite }> = new Map();
const waterTexture = PIXI.Texture.from("water.png");
const shipTexture = PIXI.Texture.from("ship.png");
const cannonBallTexure = PIXI.Texture.from("cannonBall.png");

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await client.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;

  const app = new PIXI.Application();
  const background = new PIXI.TilingSprite(waterTexture, 800, 600);
  app.stage.addChild(background);

  const connection = await getClient(token, (state) => {
    const updatedEntities = new Set();
    state.entities.forEach(({ id, type, location, angle }) => {
      updatedEntities.add(id);
      if (!entities.has(id)) {
        const sprite = new PIXI.Sprite(getTextureForType(type));
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, { entity: new Entity(location, angle), sprite });
      } else {
        entities.get(id)!.entity.updateTarget(location, angle, state.updatedAt + BUFFER_TIME);
      }
    });
    for (const entityId of entities.keys()) {
      if (!updatedEntities.has(entityId)) {
        entities.get(entityId)!.sprite.destroy();
        entities.delete(entityId);
      }
    }
  });

  app.view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) {
      connection.fireCannon({ target: { x: e.offsetX, y: e.offsetY } });
    } else {
      connection.moveShip({ target: { x: e.offsetX, y: e.offsetY } });
    }
  });
  app.view.addEventListener("contextmenu", (e) => {
    e.preventDefault();
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
  if (window.location.pathname.length > 1) {
    const stateId = window.location.pathname.split("/").pop()!;
    return client.connectExisting(token, stateId, onStateChange);
  } else {
    const connection = await client.connectNew(token, {}, onStateChange);
    window.history.pushState({}, "", `/${connection.stateId}`);
    return connection;
  }
}

function getTextureForType(type: EntityType) {
  switch (type) {
    case EntityType.SHIP:
      return shipTexture;
    case EntityType.CANNON_BALL:
      return cannonBallTexure;
  }
}
