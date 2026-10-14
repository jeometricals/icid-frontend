// A PIR page's geometry. Everything stored about a page (a flag's sketch_x / sketch_y) is in the page's native,
// unrotated pixel space: x to the right and y down from the top-left corner of the PNG as uploaded, 0..width_px and
// 0..height_px. A page's rotation_deg only changes how it is shown: the image and the sketch overlay are drawn in
// native space inside one box, and that box is turned with a CSS transform, so stored positions stay valid at
// every rotation.

/** Whether a rotation lays the page on its side, swapping its width and height on screen. */
export const isSideways = (rotation) => rotation === 90 || rotation === 270

/** The page's size on screen once rotated: {width, height} in its own pixels. */
export function rotatedSize({ width_px: width, height_px: height, rotation_deg: rotation }) {
  return isSideways(rotation) ? { width: height, height: width } : { width, height }
}
