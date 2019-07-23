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

const ImgLoaderContext = createContext(null);
const Status = {
  IDLE: 0,
  PENDING: 1,
  LOADED: 2,
  ERROR: 3,
};
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

export function ImageLoader({ children }) {
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
    function getStatus(src) {
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
    function getValue(src) {
      return cache[src];
    }
    async function loadImage(src, imgNode) {
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
        imgNode.parentNode.style.height = `${height}px`;

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

export function useImgLoader(src, config) {
  const { lazy, imgNode } = config;
  const { getStatus, loadImage } = useContext(ImgLoaderContext);
  const _observer = useRef(null);

  const status = getStatus(src);

  useEffect(() => {
    let observer;
    if (status === Status.IDLE && imgNode instanceof HTMLImageElement) {
      if (lazy) {
        observer = getObserver();
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

    function handleIntersect(entries, self) {
      const { target, intersectionRatio } = entries[0];
      if (intersectionRatio > 0) {
        loadImage(src, target);
        self.unobserve(target);
      }
    }

    return () => {
      if (observer && lazy && imgNode !== null) {
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

  return DEFAULT_PLACEHOLDER;
}

export function SimpleImg(props) {
  const { src, importance, style = {}, ...rest } = props;
  const { width, height } = rest;
  const [imgNode, setImgNode] = useState(null);
  const imgSrc = useImgLoader(src, {
    lazy: importance === 'low',
    imgNode,
  });
  const assignNode = useCallback((node) => {
    if (node !== null) {
      setImgNode(node);
    }
  }, []);
  const shouldStretch = !width && !height;
  const shouldShow = imgSrc !== DEFAULT_PLACEHOLDER;

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

function composeStyles(...styles) {
  const combinedStyle = {};
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    if (typeof style === 'boolean') {
      continue;
    }
    for (const key in style) {
      // eslint-disable-next-line
      if (style.hasOwnProperty(key)) {
        combinedStyle[key] = style[key];
      }
    }
  }
  return combinedStyle;
}

function isPromise(val) {
  return val && typeof val.then === 'function';
}

function fetchImg(src) {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.src = src;
    img.onload = (e) => resolve(e.target);
    img.onerror = reject;
  });
}

function debounce(fn, delay) {
  let timeoutID = null;
  return function() {
    clearTimeout(timeoutID);
    const args = arguments;
    const that = this;
    timeoutID = setTimeout(function() {
      fn.apply(that, args);
    }, delay);
  };
}
