import * as React from 'react';

const {
  useState,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useContext,
  useMemo,
  createContext,
} = React;

type ImgLoaderContextApi = {
  getStatus: (src: string) => Status;
  getValue: (src: string) => CachedEntry;
  loadImage: (src: string, imgNode: HTMLImageElement) => void;
};

type ImageLoaderProps = {
  children: React.ReactNode;
};

type ReactHTMLImgElementProps = React.DetailedHTMLProps<
  React.ImgHTMLAttributes<HTMLImageElement>,
  HTMLImageElement
>;

type SimpleImgProps = ReactHTMLImgElementProps & {
  importance?: 'auto' | 'low';
  placeholder?: string;
};

type CachedEntry = Promise<any> | boolean;

type ImgLoaderConfig = {
  lazy?: boolean;
  imgNode?: HTMLImageElement;
  placeholder?: string;
};

enum Status {
  IDLE = 0,
  PENDING = 1,
  LOADED = 2,
  ERROR = 3,
}

const supportsIntersectionObserver =
  typeof window !== 'undefined' &&
  'IntersectionObserver' in window &&
  'IntersectionObserverEntry' in window;
const ImgLoaderContext = createContext<ImgLoaderContextApi | null>(null);
const CONFIG = {
  rootMargin: '0px 0px',
  threshold: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
};
const DEFAULT_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const styles = {
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: '0.3s opacity ease',
    opacity: 0,
  },
  reveal: {
    opacity: 1,
  },
  stretch: {
    width: '100%',
  },
};

export function ImageLoader({ children }: ImageLoaderProps) {
  const [cache, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case 'willLoad':
        return {
          ...state,
          [action.payload.src]: action.payload.promise,
        };
      case 'didLoad':
        return {
          ...state,
          [action.payload]: true,
        };
      case 'didCatch':
        return {
          ...state,
          [action.payload]: false,
        };
      default:
        return state;
    }
  }, {});

  const imgLoaderApi = useMemo(() => {
    function getStatus(src: string) {
      const value = getValue(src);
      if (typeof value === 'undefined') {
        return Status.IDLE;
      }
      if (isPromise(value)) {
        return Status.PENDING;
      }
      if (value === true) {
        return Status.LOADED;
      }
      if (value === false) {
        return Status.ERROR;
      }
      throw new Error(`Unreachable state`);
    }
    function getValue(src: string) {
      return cache[src];
    }
    async function loadImage(src: string, imgNode: HTMLImageElement) {
      const status = getStatus(src);
      let promise;
      if (status === Status.IDLE) {
        promise = fetchImg(src);
        dispatch({
          type: 'willLoad',
          payload: {
            src,
            promise,
          },
        });
      } else if (status === Status.PENDING) {
        promise = getValue(src);
      } else if (status === Status.LOADED) {
        return true;
      } else {
        return false;
      }

      try {
        const { height } = await promise;

        // set parent height
        const { parentNode } = imgNode;
        if (parentNode instanceof HTMLElement) {
          parentNode.style.height = `${height}px`;
        }

        dispatch({ type: 'didLoad', payload: src });
        return true;
      } catch (err) {
        dispatch({ type: 'didCatch', payload: src });
        return false;
      }
    }
    return {
      getStatus,
      getValue,
      loadImage: debounce(loadImage, 16),
    };
  }, [cache]);

  return (
    <ImgLoaderContext.Provider value={imgLoaderApi}>
      {children}
    </ImgLoaderContext.Provider>
  );
}

function useImgLoaderContext() {
  const ctx = useContext(ImgLoaderContext);
  if (ctx === null) {
    throw new Error(
      `SimpleImg: Cannot find any ImgLoaderContext value. Did you forget to wrap your app with <ImageLoader />?`
    );
  }
  return ctx;
}

export function useImgLoader(src: string, config: ImgLoaderConfig = {}) {
  const { lazy, imgNode, placeholder = DEFAULT_PLACEHOLDER } = config;
  const { getStatus, loadImage } = useImgLoaderContext();
  const _observer = useRef(null);

  const status = getStatus(src);

  useEffect(() => {
    let observer: IntersectionObserver;
    if (status === Status.IDLE && imgNode instanceof HTMLImageElement) {
      if (lazy) {
        if (!supportsIntersectionObserver) {
          if (__DEV__) {
            console.error(
              'Warning: your browser does not support IntersectionObserver. ' +
                'Image will not be lazily loaded. ' +
                'If this is not acceptable, you can try polyfilling IntersectionObserver.'
            );
          }
          // fall back to eager load
          loadImage(src, imgNode);
        }
        observer = getObserver() as IntersectionObserver;
        observer.observe(imgNode);
      } else {
        loadImage(src, imgNode);
      }
    }

    function getObserver() {
      if (_observer.current === null) {
        return new IntersectionObserver(handleIntersect, CONFIG);
      }
      return _observer.current;
    }

    function handleIntersect(
      entries: Array<IntersectionObserverEntry>,
      self: IntersectionObserver
    ) {
      const { target, intersectionRatio } = entries[0];
      if (intersectionRatio > 0 && target instanceof HTMLImageElement) {
        loadImage(src, target);
        self.unobserve(target);
      }
    }

    return () => {
      if (observer && lazy && imgNode instanceof HTMLElement) {
        observer.unobserve(imgNode);
      }
    };
  }, [status, src, loadImage, lazy, imgNode]);

  if (status === Status.LOADED) {
    return src;
  }

  if (status === Status.ERROR) {
    throw new Error(`SimpleImg: Failed to load img: ${src}`);
  }

  return placeholder;
}

export function SimpleImg(props: SimpleImgProps) {
  const {
    src = '',
    importance = 'auto',
    placeholder = DEFAULT_PLACEHOLDER,
    style = {},
    ...rest
  } = props;

  const { width, height } = rest;
  const [imgNode, setImgNode] = useState<HTMLImageElement | null>(null);
  const imgSrc = useImgLoader(src, {
    lazy: importance === 'low',
    imgNode: imgNode instanceof HTMLImageElement ? imgNode : undefined,
    placeholder,
  });
  const assignNode = useCallback(node => {
    if (node !== null) {
      setImgNode(node);
    }
  }, []);
  const shouldStretch = !width && !height;
  const shouldShow = imgSrc !== placeholder;

  return (
    <div style={composeStyles(styles.wrapper, shouldShow && styles.reveal)}>
      <img
        ref={assignNode}
        src={imgSrc}
        style={composeStyles(style, shouldStretch && styles.stretch)}
        {...rest}
      />
    </div>
  );
}

function composeStyles(...styles: any[]) {
  const combinedStyle = {};
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    if (typeof style === 'boolean') {
      continue;
    }
    for (const key in style) {
      // eslint-disable-next-line
      if (style.hasOwnProperty(key)) {
        // @ts-ignore
        combinedStyle[key] = style[key];
      }
    }
  }
  return combinedStyle;
}

function isPromise(val: any) {
  return val && typeof val.then === 'function';
}

function fetchImg(src: string) {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.src = src;
    img.onload = e => resolve(e.target);
    img.onerror = reject;
  });
}

function debounce(fn: Function, delay: number) {
  let timeoutID: any;
  return function(...args: any[]) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(function() {
      fn(...args);
    }, delay);
  };
}
