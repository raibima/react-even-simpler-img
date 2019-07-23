import * as React from 'react';
import debounce from 'lodash.debounce';

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
  ERROR: 3
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
    async function loadImage(src) {
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
        await promise;
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
    if (status === Status.IDLE) {
      if (lazy) {
        if (imgNode === null) {
          return;
        }
        console.log('Observing:', imgNode);
        observer = getObserver();
        observer.observe(imgNode);
      } else {
        loadImage(src);
      }
    }

    function getObserver() {
      if (_observer.current === null) {
        return new IntersectionObserver(handleIntersect);
      }
      return _observer.current;
    }

    function handleIntersect(entries, self) {
      const { target, isIntersecting } = entries[0];
      if (isIntersecting) {
        console.log('Intersecting:', target);
        loadImage(src);
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

  return "";
}

export function SimpleImg(props) {
  const { src, importance, ...rest } = props;
  const [imgNode, setImgNode] = useState(null);
  const imgSrc = useImgLoader(src, {
    lazy: importance === "low",
    imgNode
  });
  const assignNode = useCallback(node => {
    if (node !== null) {
      setImgNode(node);
    }
  }, []);

  return <img ref={assignNode} src={imgSrc} {...rest} />;
}

function isPromise(val) {
  return val && typeof val.then === "function";
}

function fetchImg(src) {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.src = src;
    img.onload = resolve;
    img.onerror = reject;
  });
}
