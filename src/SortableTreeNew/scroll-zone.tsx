import React from 'react';
import { DndContext } from 'react-dnd';
import { type DragDropManager } from 'dnd-core';

export interface ScrollingComponentProps {
  dragDropManager?: DragDropManager;
  horizontalStrength?: (size: Size, point: Point) => number;
  onScrollChange?: (left: number, top: number) => void;
  rowHeight?: number;
  strengthMultiplier?: number;
  verticalStrength?: (size: Size, point: Point) => number;
}

const throttle = (func: Function, timeFrame: number) => {
  let lastTime = 0;
  return (...args: unknown[]) => {
    const now = Date.now();
    if (now - lastTime >= timeFrame) {
      func(...args);
      lastTime = now;
    }
  };
};

const intBetween = (min: number, max: number, val: number) =>
  Math.floor(Math.min(max, Math.max(min, val)));

const getCoords = (evt: DragEvent) => {
  return { x: evt.clientX, y: evt.clientY };
};

const DEFAULT_BUFFER = 150;

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  h: number;
  w: number;
  x: number;
  y: number;
};

export const createHorizontalStrength =
  (_buffer: number) =>
  ({ h, w, x, y }: Size, point: Point) => {
    const buffer = Math.min(w / 2, _buffer);
    const inRange = point.x >= x && point.x <= x + w;
    const inBox = inRange && point.y >= y && point.y <= y + h;

    if (inBox) {
      if (point.x < x + buffer) {
        return (point.x - x - buffer) / buffer;
      }
      if (point.x > x + w - buffer) {
        return -(x + w - point.x - buffer) / buffer;
      }
    }

    return 0;
  };

export const createVerticalStrength =
  (_buffer: number) =>
  ({ h, w, x, y }: Size, point: Point) => {
    const buffer = Math.min(h / 2, _buffer);
    const inRange = point.y >= y && point.y <= y + h;
    const inBox = inRange && point.x >= x && point.x <= x + w;

    if (inBox) {
      if (point.y < y + buffer) {
        return (point.y - y - buffer) / buffer;
      }
      if (point.y > y + h - buffer) {
        return -(y + h - point.y - buffer) / buffer;
      }
    }

    return 0;
  };

export function createScrollingComponent<P extends object>(
  WrappedComponent: React.ComponentType<P>,
) {
  return (props: ScrollingComponentProps) => {
    const {
      horizontalStrength = createHorizontalStrength(DEFAULT_BUFFER),
      onScrollChange = () => {},
      strengthMultiplier = 30,
      verticalStrength = createVerticalStrength(DEFAULT_BUFFER),
      ...restProps
    } = props;

    const wrappedInstance = React.createRef<HTMLElement>();
    const animationFrameID = React.useRef(0);

    let scaleX = 0;
    let scaleY = 0;

    let attached = false;
    let dragging = false;

    // Update scaleX and scaleY every 100ms or so
    // and start scrolling if necessary
    const updateScrolling = throttle((evt: DragEvent) => {
      const { current: container } = wrappedInstance;
      if (container === null) {
        return;
      }

      const { height: h, left: x, top: y, width: w } = container.getBoundingClientRect();
      const box = {
        x,
        y,
        w,
        h,
      };
      const coords = getCoords(evt);

      // calculate strength
      scaleX = horizontalStrength(box, coords);
      scaleY = verticalStrength(box, coords);

      // start scrolling if we need to
      if (!animationFrameID.current && (scaleX || scaleY)) {
        startScrolling();
      }
    }, 100);

    const handleEvent = (evt: DragEvent) => {
      if (dragging && !attached) {
        attached = true;
        window.document.body.addEventListener('dragover', updateScrolling);
        updateScrolling(evt);
      }
    };

    React.useEffect(() => {
      const { current: container } = wrappedInstance;

      if (container && typeof container.addEventListener === 'function') {
        container.addEventListener('dragover', handleEvent);
      }

      const clearMonitorSubscription = props.dragDropManager
        ?.getMonitor()
        .subscribeToStateChange(handleMonitorChange);

      return () => {
        if (container && typeof container.removeEventListener === 'function') {
          container.removeEventListener('dragover', handleEvent);
        }
        clearMonitorSubscription?.();
        stopScrolling();
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMonitorChange = () => {
      const isDragging = props.dragDropManager?.getMonitor().isDragging();

      if (!dragging && isDragging) {
        dragging = true;
      } else if (dragging && !isDragging) {
        dragging = false;
        stopScrolling();
      }
    };

    const startScrolling = () => {
      const { current: container } = wrappedInstance;
      if (container === null) {
        return;
      }

      let i = 0;
      const tick = () => {
        // stop scrolling if there's nothing to do
        if (strengthMultiplier === 0 || scaleX + scaleY === 0) {
          stopScrolling();
          return;
        }

        // there's a bug in safari where it seems like we can't get
        // mousemove events from a container that also emits a scroll
        // event that same frame. So we double the strengthMultiplier and only adjust
        // the scroll position at 30fps
        i += 1;
        if (i % 2) {
          const { clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth } =
            container;

          const newLeft = scaleX
            ? (container.scrollLeft = intBetween(
                0,
                scrollWidth - clientWidth,
                scrollLeft + scaleX * strengthMultiplier,
              ))
            : scrollLeft;

          const newTop = scaleY
            ? (container.scrollTop = intBetween(
                0,
                scrollHeight - clientHeight,
                scrollTop + scaleY * strengthMultiplier,
              ))
            : scrollTop;

          onScrollChange(newLeft, newTop);
        }
        animationFrameID.current = window.requestAnimationFrame(tick);
      };

      tick();
    };

    const stopScrolling = () => {
      attached = false;
      window.document.body.removeEventListener('dragover', updateScrolling);

      scaleX = 0;
      scaleY = 0;

      if (animationFrameID.current) {
        window.cancelAnimationFrame(animationFrameID.current);
        animationFrameID.current = 0;
      }
    };

    return (
      <WrappedComponent
        ref={wrappedInstance}
        dragDropManager={props.dragDropManager}
        {...(restProps as P)}
      />
    );
  };
}

function withScrolling<P extends object>(WrappedComponent: React.ComponentType<P>) {
  const ScrollingComponent = createScrollingComponent(WrappedComponent);
  return (props: ScrollingComponentProps) => {
    return (
      <DndContext.Consumer>
        {({ dragDropManager }) =>
          !dragDropManager ? undefined : (
            <ScrollingComponent {...props} dragDropManager={dragDropManager} />
          )
        }
      </DndContext.Consumer>
    );
  };
}

export default withScrolling;
