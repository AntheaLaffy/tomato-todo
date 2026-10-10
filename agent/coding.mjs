// Preserve Pi's coding tool schemas and behavior inside an app-owned workspace.
import { createReadToolDefinition, createWriteToolDefinition, createEditToolDefinition, createBashToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition } from "@earendil-works/pi-coding-agent";
import { access, readFile, writeFile, mkdir, realpath, lstat, readdir } from "node:fs/promises";
import { resolve, join, relative, dirname, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import { minimatch } from "minimatch";

export async function codingTools(dir, runtimeRoot, preferences = {}) {
  const workspace=join(dir,"workspace"), coding=join(workspace,"coding"), tools=join(dir,"tools");
  await mkdir(coding,{recursive:true,mode:0o700});
  await mkdir(tools,{recursive:true,mode:0o700});
  const inside=(root,path)=>path===root || (!relative(root,path).startsWith("..") && !isAbsolute(relative(root,path)));
  async function path(value,writing=false) {
    const translated=value==="/workspace"||value.startsWith("/workspace/")?join(workspace,value.slice("/workspace".length)):value;
    const target=resolve(coding,translated);
    if (!inside(writing?coding:workspace,target) || target.endsWith(".origin")) throw new Error(writing?"编程工具只写入工作区 coding/，软件数据通过 MCP 或审阅文件修改":"只能读取当前工作区；认证与数据库不在可读范围内");
    let ancestor=target;
    while (true) {try {if ((await lstat(ancestor)).isSymbolicLink()) throw new Error("工作区不能访问符号链接"); const actual=await realpath(ancestor);if(!inside(writing?coding:workspace,actual)) throw new Error("路径离开工作区");break;}catch(error){if(error.code!=="ENOENT")throw error;ancestor=dirname(ancestor);}}
    return target;
  }
  const read=async(p)=>{const safe=await path(p);if((await lstat(safe)).size>8*1024*1024)throw new Error("文件超过8MB，请使用分段 JSON 工具");return readFile(safe);};
  const write=async(p,value)=>{const safe=await path(p,true);if(Buffer.byteLength(value)>8*1024*1024)throw new Error("文件超过8MB");await mkdir(dirname(safe),{recursive:true,mode:0o700});await writeFile(safe,value,{mode:0o600});};
  const checkRead=async(p)=>access(await path(p));
  const checkWrite=async(p)=>{await path(p,true);};
  const full=preferences.codingAccess==="full";
  const exec=async(command,cwd,options)=>{
    await path(cwd,true);
    await mkdir(tools,{recursive:true,mode:0o700});
    const run=(bin,args,spawnOptions)=>new Promise((resolve,reject)=>{
      const child=spawn(bin,args,{stdio:["ignore","pipe","pipe"],...spawnOptions});
      let total=0,limited=false;
      const receive=(bytes)=>{total+=bytes.length;if(total<=1024*1024)options.onData(bytes);else if(!limited){limited=true;options.onData(Buffer.from("\n[输出超过1MB，已停止]\n"));child.kill("SIGKILL");}};
      child.stdout.on("data",receive);child.stderr.on("data",receive);
      const stop=()=>child.kill("SIGKILL");options.signal?.addEventListener("abort",stop,{once:true});
      const timer=setTimeout(stop,Math.min(options.timeout?options.timeout*1000:60000,120000));
      child.on("error",reject);child.on("close",(code)=>{clearTimeout(timer);options.signal?.removeEventListener("abort",stop);resolve({exitCode:code??137});});
    });
    // Isolation is a user-chosen policy, not a privilege boundary: the process runs
    // as the user either way, so "full" only grants access the user already has and
    // never escalates. "workspace" keeps the design's file boundary and still lets
    // the terminal install toolchains over the host network.
    if(full) return run("/usr/bin/bash",["--noprofile","--norc","-c",command],{cwd});
    const net=["--unshare-all","--share-net","--ro-bind-try","/etc/resolv.conf","/etc/resolv.conf","--ro-bind-try","/etc/hosts","/etc/hosts","--ro-bind-try","/etc/nsswitch.conf","/etc/nsswitch.conf","--ro-bind-try","/etc/ssl","/etc/ssl","--ro-bind-try","/etc/pki","/etc/pki","--ro-bind-try","/etc/ca-certificates","/etc/ca-certificates","--ro-bind-try","/etc/ca-certificates.conf","/etc/ca-certificates.conf","--ro-bind-try","/etc/passwd","/etc/passwd","--ro-bind-try","/etc/group","/etc/group","--ro-bind-try","/etc/gitconfig","/etc/gitconfig"];
    const args=["--die-with-parent","--new-session",...net,"--ro-bind","/usr","/usr","--ro-bind-try","/lib","/lib","--ro-bind-try","/lib64","/lib64","--ro-bind-try","/bin","/bin","--ro-bind-try","/etc/ld.so.cache","/etc/ld.so.cache","--proc","/proc","--dev","/dev","--tmpfs","/tmp","--ro-bind",workspace,"/workspace","--bind",coding,"/workspace/coding","--bind",tools,"/tools","--ro-bind",runtimeRoot,"/runtime","--clearenv","--setenv","PATH","/tools/.cargo/bin:/tools/.npm/bin:/tools/npm-global/bin:/runtime/bin:/usr/bin:/bin","--setenv","HOME","/tools","--setenv","CARGO_HOME","/tools/.cargo","--setenv","RUSTUP_HOME","/tools/.rustup","--setenv","npm_config_cache","/tools/npm-cache","--setenv","npm_config_prefix","/tools/npm-global","--setenv","XDG_CACHE_HOME","/tools/cache","--setenv","XDG_CONFIG_HOME","/tools/config","--setenv","LANG","C.UTF-8","--setenv","TERM","dumb","--chdir","/workspace/coding","/usr/bin/bash","--noprofile","--norc","-c",command];
    return run("bwrap",args,{});
  };

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
    const safe=await path(args.path||coding);const virtual="/workspace/"+relative(workspace,safe);
    const quote=(s)=>"'"+String(s).replaceAll("'","'\\''")+"'";
    const flags=["--no-messages","--line-number","--color=never","--max-count",String(Math.min(Math.max(args.limit||100,1),1000))];
    if(args.ignoreCase)flags.push("-i");if(args.literal)flags.push("-F");if(args.glob)flags.push("-g",args.glob);if(args.context)flags.push("-C",String(Math.min(args.context,20)));
    flags.push("--",args.pattern,virtual);let output="";
    const result=await exec("rg "+flags.map(quote).join(" "),coding,{signal,onData:b=>output+=b.toString(),timeout:30});
    return {content:[{type:"text",text:output.slice(0,30000)||(result.exitCode===1?"No matches found":"ripgrep 未安装或搜索失败")}],details:{exitCode:result.exitCode}};
  };
  definitions.push(grep);
  for(const definition of definitions){definition.description+=" 工作区根为 /workspace，读可用导出文件；写和 Shell 只操作 /workspace/coding。Shell 没有网络、用户主目录或软件数据库访问。";definition.executionMode="sequential";}
  return definitions;
}
