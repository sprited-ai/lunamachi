// <StarField count="110"/> — scattered stars across the upper sky, twinkling.

import type { RoomComponent, Prop } from "../types";
import { addStarField } from "../shared";
import { attr, int } from "../coerce";

interface StarFieldProp extends Prop {
  type: "starField";
  count: number;
}

const StarField: RoomComponent = {
  tag: "StarField",
  type: "starField",
  parse: (el) => ({ type: "starField", count: int(attr(el, "count")) } satisfies StarFieldProp),
  mount: (prop, { container, w, h, rng }) => {
    const p = prop as StarFieldProp;
    return addStarField(container, w, h, p.count, rng);
  },
};

export default StarField;
