// Chair-local dimensions, shared by the set and the model-clearance regression.
export const chairSeat = {
  // End the cushion behind the knee bend; its top sits below the thigh shells.
  position: [0, .655, -.13] as [number, number, number],
  size: [.9, .14, .52] as [number, number, number],
};
export const robotSeatedPosition: [number, number, number] = [0, .35, .34];
export const robotIdleBob = .004;
