// React 桥：客户端半的工厂只拿到 `require`，这里把它变成模块级活绑定。
//
// 为什么用活绑定而不是包装对象：所有组件模块都从本文件 import h/useState…，
// 它们只在渲染期调用这些名字，而 installRuntime 在 apply 之前完成，因此
// ESM 的 live binding 足以让整套组件在打包后保持正常（也避免了给每个
// 组件传一个 react 参数）。
let React = null;

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
}

/** 已安装的 React 命名空间（只有需要 React.Children 之类时才用）。 */
export function react() {
  return React;
}

/** 合并 className 字符串 / 布尔片段。 */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
