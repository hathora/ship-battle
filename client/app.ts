import * as PIXI from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { EntityType, PlayerState } from "./.rtag/types";
import { Entity } from "./Entity";

const BUFFER_TIME = 140;

const entities: Map<string, { entity: Entity; sprite: PIXI.Sprite }> = new Map();
const waterTexture = PIXI.Texture.from("water.png");
const shipTexture = PIXI.Texture.from("ship.png");

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await RtagClient.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;

  const app = new PIXI.Application();
  const waterSprite = new PIXI.TilingSprite(waterTexture, 800, 600);
  app.stage.addChild(waterSprite);

  const client = await getClient(token, (state) => {
    state.entities.forEach(({ id, type, location }) => {
      if (!entities.has(id)) {
        const sprite = new PIXI.Sprite(getTexture(type));
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, { entity: new Entity(location), sprite });
      } else {
        entities.get(id)!.entity.updateTarget(location, state.updatedAt + BUFFER_TIME);
      }
    });
  });

  app.view.addEventListener("pointerdown", (e) => {
    client.updateTarget({ target: { x: e.offsetX, y: e.offsetY } });
  });

  const draw = () => {
    const now = Date.now();
    entities.forEach(({ entity, sprite }) => {
      const { x, y } = entity.getCurrPos(now);
      if (x !== sprite.x && y !== sprite.y) {
        sprite.rotation = Math.atan2(y - sprite.y, x - sprite.x) - Math.PI / 2;
        sprite.x = x;
        sprite.y = y;
      }
    });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  return app.view;
}

async function getClient(token: string, onStateChange: (state: PlayerState) => void) {
  if (window.location.pathname.length > 1) {
    const stateId = window.location.pathname.split("/").pop()!;
    return RtagClient.connectExisting(import.meta.env.VITE_APP_ID, token, stateId, onStateChange);
  } else {
    const { stateId, client } = await RtagClient.connectNew(import.meta.env.VITE_APP_ID, token, {}, onStateChange);
    window.history.pushState({}, "", `/${stateId}`);
    return client;
  }
}

function getTexture(type: EntityType) {
  switch (type) {
    case EntityType.SHIP:
      return shipTexture;
  }
}
