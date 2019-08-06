# React Even Simpler Img

Smaller (< 2KB) alternative of react-simple-img that doesn't include IntersectionObserver polyfill.

## Install

```bash
npm install --save react-even-simpler-img
```

## Import

```tsx
import { ImageLoader, SimpleImg } from 'react-even-simpler-img';
```

## Usage

First, wrap your app with <ImageLoader />:

```tsx
ReactDOM.render(
  <ImageLoader>
    <App />
  </ImageLoader>,
  rootNode
);
```

Use <SimpleImg /> as if it's a normal HTML Image element

```tsx
<SimpleImg src="https://picsum.photos/40" />
```

## Lazy Loading

To lazy load images, set `importance` prop to `low`:

```tsx
<SimpleImg src="https://picsum.photos/40" importance="low" />
```

This library uses IntersectionObserver to lazy load images. If the browser doesn't support it, this library will _gracefully degrade_ to eager loading approach.

## Error Handling

To display a fallback when the image fails to load, you need to wrap it with an [Error Boundary](https://reactjs.org/docs/error-boundaries.html).

```tsx
// you need to have your own implementation
// of React error boundary
import ErrorBoundary from './MyErrorBoundary';

<ErrorBoundary fallback={<MyImgFallback />}>
  <SimpleImg src="https://rubbish.xyz/foo/bar.jpg" />
</ErrorBoundary>;
```

Also check out [react-error-boundary](https://github.com/bvaughn/react-error-boundary) for ready-made ErrorBoundary component!
