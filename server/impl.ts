import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  PlayerState,
  ICreateGameRequest,
  IUpdateTargetRequest,
  PlayerName,
  Point,
  EntityType,
} from "./.rtag/types";

interface InternalPlayerInfo {
  name: PlayerName;
  location: Point;
  target?: Point;
}

interface InternalState {
  players: InternalPlayerInfo[];
  updatedAt: number;
}

const SPEED = 200;

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      players: [{ name: user.name, location: { x: 0, y: 0 } }],
      updatedAt: 0,
    };
  }
  updateTarget(state: InternalState, user: UserData, ctx: Context, request: IUpdateTargetRequest): Result {
    const player = state.players.find((p) => p.name == user.name);
    if (player === undefined) {
      state.players.push({ name: user.name, location: request.target });
    } else {
      player.target = request.target;
    }
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): PlayerState {
    const player = state.players.find((p) => p.name == user.name);
    return {
      entities: state.players.map(({ name, location }) => ({ id: name, type: EntityType.SHIP, location })),
      target: player?.target,
      updatedAt: state.updatedAt,
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): Result {
    let modified = false;
    state.players.forEach((player) => {
      if (player.target !== undefined) {
        const dx = player.target.x - player.location.x;
        const dy = player.target.y - player.location.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pixelsToMove = SPEED * timeDelta;
        if (dist <= pixelsToMove) {
          player.location = player.target;
          player.target = undefined;
        } else {
          player.location.x += (dx / dist) * pixelsToMove;
          player.location.y += (dy / dist) * pixelsToMove;
        }
        state.updatedAt = Date.now();
        modified = true;
      }
    });
    return modified ? Result.modified() : Result.unmodified();
  }
}
