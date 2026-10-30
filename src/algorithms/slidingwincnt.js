export function createSlidWinCnt({
  windowMs,
  capacity,
  clock
}) {
  if(!Number.isFinite(windowMs) || windowMs < 0){
    throw new TypeError("windowMs should be positive finite integer");
  }
  if(!Number.isSafeInteger(capacity) || capacity < 0){
    throw new TypeError("capacity should be positive safe integer");
  }

  const catalogs = new Map();

  function consume(key){
    if(typeof key !== "string" || key.length === 0){
      throw new TypeError("key should be no empty string");
    }


  }
}
