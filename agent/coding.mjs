// Preserve Pi's coding tool schemas and behavior inside an app-owned workspace.
import { createReadToolDefinition, createWriteToolDefinition, createEditToolDefinition, createBashToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition } from "@earendil-works/pi-coding-agent";
import { access, readFile, writeFile, mkdir, realpath, lstat, readdir } from "node:fs/promises";
import { resolve, join, relative, dirname, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import { minimatch } from "minimatch";

// bwrap 的 --clearenv 拿掉了 TZ，也没挂 /etc/localtime，沙箱里的 date 会退回 UTC；
// 把本机时区显式传进去，date、cargo test 里的本地时间才和 Rust 的 Local 一致。
export function sandboxEnv() {
  return ["--clearenv","--setenv","PATH","/tools/.cargo/bin:/tools/.npm/bin:/tools/npm-global/bin:/runtime/bin:/usr/bin:/bin","--setenv","HOME","/tools","--setenv","CARGO_HOME","/tools/.cargo","--setenv","RUSTUP_HOME","/tools/.rustup","--setenv","npm_config_cache","/tools/npm-cache","--setenv","npm_config_prefix","/tools/npm-global","--setenv","XDG_CACHE_HOME","/tools/cache","--setenv","XDG_CONFIG_HOME","/tools/config","--setenv","LANG","C.UTF-8","--setenv","TZ",Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC","--setenv","TERM","dumb"];
}

export async function codingTools(dir, runtimeRoot, preferences = {}, onShutdown = () => {}) {
  const workspace=join(dir,"workspace"), coding=join(workspace,"coding"), tools=join(dir,"tools");
  await mkdir(coding,{recursive:true,mode:0o700});
  await mkdir(tools,{recursive:true,mode:0o700});
  const projectRoots=(preferences.projectMounts??[]).map(m=>resolve(m.directory));
  const inside=(root,path)=>path===root || (!relative(root,path).startsWith("..") && !isAbsolute(relative(root,path)));
  async function path(value,writing=false) {
    if(preferences.codingAccess==="full")return resolve(coding,value);
    const translated=value==="/workspace"||value.startsWith("/workspace/")?join(workspace,value.slice("/workspace".length)):value;
    const target=resolve(coding,translated);
    const boundary=projectRoots.find(root=>inside(root,target))||(writing?coding:workspace);
    if (!inside(boundary,target) || target.endsWith(".origin")) throw new Error(writing?"编程工具只写入工作区 coding/，软件数据通过 MCP 或审阅文件修改":"只能读取当前工作区；认证与数据库不在可读范围内");
    let ancestor=target;
    while (true) {try {if ((await lstat(ancestor)).isSymbolicLink()) throw new Error("工作区不能访问符号链接"); const actual=await realpath(ancestor);if(!inside(boundary,actual)) throw new Error("路径离开工作区");break;}catch(error){if(error.code!=="ENOENT")throw error;ancestor=dirname(ancestor);}}
    return target;
  }
  const read=async(p)=>{const safe=await path(p);if((await lstat(safe)).size>8*1024*1024)throw new Error("文件超过8MB，请使用分段 JSON 工具");return readFile(safe);};
  const write=async(p,value)=>{const safe=await path(p,true);if(Buffer.byteLength(value)>8*1024*1024)throw new Error("文件超过8MB");await mkdir(dirname(safe),{recursive:true,mode:0o700});await writeFile(safe,value,{mode:0o600});};
  const checkRead=async(p)=>access(await path(p));
  const checkWrite=async(p)=>{await path(p,true);};
  const full=preferences.codingAccess==="full";
  const net=["--unshare-all","--share-net","--ro-bind-try","/etc/resolv.conf","/etc/resolv.conf","--ro-bind-try","/etc/hosts","/etc/hosts","--ro-bind-try","/etc/nsswitch.conf","/etc/nsswitch.conf","--ro-bind-try","/etc/ssl","/etc/ssl","--ro-bind-try","/etc/pki","/etc/pki","--ro-bind-try","/etc/ca-certificates","/etc/ca-certificates","--ro-bind-try","/etc/ca-certificates.conf","/etc/ca-certificates.conf","--ro-bind-try","/etc/passwd","/etc/passwd","--ro-bind-try","/etc/group","/etc/group","--ro-bind-try","/etc/gitconfig","/etc/gitconfig"];
  const mounts=["--ro-bind","/usr","/usr","--ro-bind-try","/lib","/lib","--ro-bind-try","/lib64","/lib64","--ro-bind-try","/bin","/bin","--ro-bind-try","/etc/ld.so.cache","/etc/ld.so.cache","--proc","/proc","--dev","/dev","--tmpfs","/tmp","--ro-bind",workspace,"/workspace","--bind",coding,"/workspace/coding","--bind",tools,"/tools","--ro-bind",runtimeRoot,"/runtime"];
  for(const root of projectRoots)mounts.push("--bind",root,root);
  const env=sandboxEnv();
  // One long-lived bash per session keeps cwd, exported variables and background
  // processes across calls. A random sentinel line ends each command, so multi-line
  // input still works and the exit code comes back on a marker.
  let shell=null,current=null,shellChain=Promise.resolve();
  function startShell(){
    const id=Math.random().toString(36).slice(2);
    const end=`__END_${id}__`,rc=`__RC_${id}__`,ps1=`__PS1_${id}__`;
    const args=full?["--noprofile","--norc"]:["--die-with-parent","--new-session",...net,...mounts,...env,"--chdir","/workspace/coding","/usr/bin/bash","--noprofile","--norc"];
    const child=spawn(full?"/usr/bin/bash":"bwrap",args,{stdio:["pipe","pipe","pipe"],...(full?{cwd:coding}:{})});
    const state={child,end,rc,ps1,buffer:""};
    child.stdin.write(`while IFS= read -r __line; do\n  if [ "$__line" = "${end}" ]; then\n    eval "$__buf"\n    printf '\\n${rc}%s\\n${ps1}\\n' "$?"\n    __buf=""\n  else\n    __buf="\${__buf}\${__line}\n"\n  fi\ndone\n`);
    const receive=(bytes)=>onShellData(state,bytes);
    child.stdout.on("data",receive);child.stderr.on("data",receive);
    child.on("error",()=>{});
    child.on("close",()=>{if(shell===state)shell=null;if(current){const entry=current;current=null;clearTimeout(entry.timer);entry.reject(new Error("终端已退出"));}});
    return state;
  }
  function emit(entry,text){
    if(!text)return;
    if(entry.overflow)return;
    const size=Buffer.byteLength(text);
    // Pi keeps long runs alive and truncates what the model sees (the full output
    // goes to a temp file there); a chatty build must not be killed for talking.
    if(entry.total+size>1024*1024){const room=Math.max(0,1024*1024-entry.total);if(room)entry.options.onData(Buffer.from(text.slice(0,room)));entry.total+=room;entry.overflow=true;entry.options.onData(Buffer.from("\n[输出超过1MB，后续输出已省略，命令继续运行]\n"));return;}
    entry.total+=size;entry.options.onData(Buffer.from(text));
  }
  function fail(entry,error){
    if(current===entry)current=null;clearTimeout(entry.timer);entry.reject(error);
    if(shell){try{shell.child.kill("SIGKILL");}catch{}shell=null;}
  }
  function onShellData(state,bytes){
    state.buffer+=bytes.toString("utf8");
    if(!current)return;
    const entry=current;
    const match=new RegExp("\\n"+state.rc+"(\\d+)\\n"+state.ps1+"\\n").exec(state.buffer);
    if(match){emit(entry,state.buffer.slice(0,match.index));state.buffer=state.buffer.slice(match.index+match[0].length);current=null;clearTimeout(entry.timer);entry.resolve({exitCode:Number(match[1])});return;}
    const keep=state.rc.length+state.ps1.length+16;
    if(state.buffer.length>keep){emit(entry,state.buffer.slice(0,state.buffer.length-keep));state.buffer=state.buffer.slice(-keep);}
  }
  function runOnce(command,cwd,options){
    if(!shell)shell=startShell();
    return new Promise((resolve,reject)=>{
      const state=shell;
      const stop=()=>fail(entry,new Error("命令已停止"));
      const entry={resolve:(value)=>{options.signal?.removeEventListener("abort",stop);resolve(value);},reject,options,total:0,overflow:false,timer:0};
      current=entry;
      // Pi's bash tool has no default timeout: left alone, a command runs until it
      // finishes or the turn is stopped; only an explicitly requested timeout applies.
      if(options.timeout)entry.timer=setTimeout(()=>fail(entry,new Error(`命令超时（${options.timeout} 秒）`)),options.timeout*1000);
      options.signal?.addEventListener("abort",stop,{once:true});
      state.child.stdin.write(`${command}\n${state.end}\n`);
    });
  }
  const exec=async(command,cwd,options)=>{
    await path(cwd,true);
    await mkdir(tools,{recursive:true,mode:0o700});
    const job=()=>runOnce(command,cwd,options);
    const result=shellChain.then(job,job);
    shellChain=result.catch(()=>{});
    return result;
  };
  const close=()=>{process.off("exit",close);try{shell?.child.kill("SIGKILL");}catch{}shell=null;};process.on("exit",close);onShutdown(close);

  const definitions=[
    createReadToolDefinition(coding,{autoResizeImages:false,operations:{readFile:read,access:checkRead,detectImageMimeType:async(p)=>{const b=await read(p);if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";if(b[0]===255&&b[1]===216)return "image/jpeg";if(b.subarray(0,4).toString()==="RIFF"&&b.subarray(8,12).toString()==="WEBP")return "image/webp";return null;}}}),
    createWriteToolDefinition(coding,{operations:{writeFile:write,mkdir:async(p)=>mkdir(await path(p,true),{recursive:true,mode:0o700})}}),
    createEditToolDefinition(coding,{operations:{readFile:async(p)=>{await path(p,true);return read(p);},writeFile:write,access:checkWrite}}),
    createBashToolDefinition(coding,{operations:{exec},exposeSessionEnvironment:false}),
    createLsToolDefinition(coding,{operations:{exists:async(p)=>{try{await access(await path(p));return true;}catch{return false;}},stat:async(p)=>lstat(await path(p)),readdir:async(p)=>(await readdir(await path(p))).filter(n=>!n.endsWith(".origin"))}}),
    createFindToolDefinition(coding,{operations:{exists:async(p)=>{try{await access(await path(p));return true;}catch{return false;}},glob:async(pattern,cwd,{limit})=>{
      const root=await path(cwd),result=[];let visited=0;
      async function walk(at,depth=0){if(depth>12||visited>10000||result.length>=Math.min(limit,1000))return;for(const entry of await readdir(at,{withFileTypes:true})){visited++;if(entry.isSymbolicLink()||entry.name.endsWith(".origin"))continue;const file=join(at,entry.name);if(entry.isDirectory())await walk(file,depth+1);else if(minimatch(relative(root,file),pattern,{dot:true}))result.push(relative(root,file));if(result.length>=Math.min(limit,1000))break;}}
      await walk(root);return result;
    }}}),
  ];
  // Keep Pi's grep interface while running ripgrep in the same mount namespace.
  const grep=createGrepToolDefinition(coding);
  grep.execute=async(_id,args,signal)=>{
    const safe=await path(args.path||coding);const virtual=full||projectRoots.some(root=>inside(root,safe))?safe:"/workspace/"+relative(workspace,safe);
    const quote=(s)=>"'"+String(s).replaceAll("'","'\\''")+"'";
    const flags=["--no-messages","--line-number","--color=never","--max-count",String(Math.min(Math.max(args.limit||100,1),1000))];
    if(args.ignoreCase)flags.push("-i");if(args.literal)flags.push("-F");if(args.glob)flags.push("-g",args.glob);if(args.context)flags.push("-C",String(Math.min(args.context,20)));
    flags.push("--",args.pattern,virtual);let output="";
    const result=await exec("rg "+flags.map(quote).join(" "),coding,{signal,onData:b=>output+=b.toString(),timeout:30});
    return {content:[{type:"text",text:output.slice(0,30000)||(result.exitCode===1?"No matches found":"ripgrep 未安装或搜索失败")}],details:{exitCode:result.exitCode}};
  };
  definitions.push(grep);
  for(const definition of definitions){definition.description+=full?" 完整访问：以用户身份读写文件并运行终端，默认目录是助手 coding/，终端有网络。":" 工作区根为 /workspace，读可用导出文件；写和 Shell 可操作 /workspace/coding 及本轮列出的用户已授权项目目录，终端有网络，不访问其他宿主目录或软件数据库。";definition.executionMode="sequential";}
  return definitions;
}
