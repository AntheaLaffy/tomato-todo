// React 桥：客户端半的工厂只拿到 `require`，这里把它变成模块级活绑定。
//
// 为什么用活绑定而不是包装对象：所有组件模块都从本文件 import h/useState…，
// 它们只在渲染期调用这些名字，而 installRuntime 在 apply 之前完成，因此
// ESM 的 live binding 足以让整套组件在打包后保持正常（也避免了给每个
// 组件传一个 react 参数）。
let React = null;
let ReactDOM = null;

export let h = null;
export let Fragment = null;
export let useState = null;
export let useEffect = null;
export let useMemo = null;
export let useRef = null;
export let useCallback = null;
export let useReducer = null;
export let createContext = null;
export let useContext = null;

/** 安装 React 与 hooks；重复调用安全（HMR 重挂同一工厂）。 */
export function installRuntime(require) {
  if (React !== null) return;
  React = require("react");
  h = React.createElement;
  Fragment = React.Fragment;
  useState = React.useState;
  useEffect = React.useEffect;
  useMemo = React.useMemo;
  useRef = React.useRef;
  useCallback = React.useCallback;
  useReducer = React.useReducer;
  createContext = React.createContext;
  useContext = React.useContext;
  // react-dom 只在需要把对话框挂到 body 时用得到；冒烟/SSR 环境拿不到就退化为内联渲染。
  try {
    ReactDOM = require("react-dom");
  } catch {
    ReactDOM = null;
  }
}

/**
 * 把节点挂到 body 上（对话框用）。
 *
 * 为什么需要：DSH 的页面内容在可滚动容器里，祖先上的 transform/filter/animation
 * 会让 position:fixed 以祖先为包含块——对话框就会跑到页面中段、遮罩只盖住内容列。
 * 挂到 body 之后，遮罩与居中始终以视口为准。SSR/无 react-dom 时退化为内联节点。
 */
export function createPortal(node, container) {
  if (!ReactDOM || typeof ReactDOM.createPortal !== "function") return node;
  if (!container) return node;
  return ReactDOM.createPortal(node, container);
}

/** 已安装的 React 命名空间（只有需要 React.Children 之类时才用）。 */
export function react() {
  return React;
}

/** 合并 className 字符串 / 布尔片段。 */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
