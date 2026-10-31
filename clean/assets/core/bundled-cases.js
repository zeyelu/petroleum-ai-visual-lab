/* Static case integration. No writes to localStorage; original import contract is unchanged. */
(function (global) {
  'use strict';
  var pending = Object.create(null);
  global.BundledCasePayloads = global.BundledCasePayloads || {};
  function load(def) {
    if (global.BundledCasePayloads[def.id]) return Promise.resolve(global.BundledCasePayloads[def.id]);
    if (pending[def.id]) return pending[def.id];
    pending[def.id] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = def.bundleUrl;
      script.onload = function () {
        script.remove();
        var payload = global.BundledCasePayloads[def.id];
        if (payload) resolve(payload);
        else { delete pending[def.id]; reject(new Error('案例资源未正确加载')); }
      };
      script.onerror = function () {
        script.remove(); delete pending[def.id];
        reject(new Error('案例资源加载失败，请检查网站文件是否完整。'));
      };
      document.head.appendChild(script);
    });
    return pending[def.id];
  }
  (global.BundledCaseCatalog || []).forEach(function (def) {
    // These scenes now have complete bundled demonstrations.
    var scene = global.ATLAS.index.byScene[def.sceneId];
    if (scene) { scene.demo = true; scene.status = 'full'; }
    var tabs = JSON.parse(JSON.stringify(def.tabs));
    var handle = null, generation = 0;
    var config = def.demo || def.tabs.demo || {};
    tabs.demo = {
      label: config.label || '案例演示', intro: config.intro || '', mode: 'page',
      mount: function (root, context) {
        var active = ++generation;
        if (handle) { handle.destroy(); handle = null; }
        root.innerHTML = '<div class="empty" role="status"><b>正在准备案例演示</b>加载本案例的数据与模型，请稍候。</div>';
        load(def).then(function (payload) {
          if (active !== generation || !root.isConnected) return;
          root.innerHTML = '';
          handle = global.CaseDemoHost.create(root, payload, context);
        }).catch(function (error) {
          if (active !== generation || !root.isConnected) return;
          root.innerHTML = '';
          var box = document.createElement('div'); box.className = 'empty';
          box.textContent = error.message;
          var retry = document.createElement('button'); retry.className = 'btn'; retry.textContent = '重新加载';
          retry.onclick = function () { tabs.demo.mount(root, context); };
          box.appendChild(retry);root.appendChild(box);
        });
      },
      unmount: function () {
        generation++;
        if (handle) { handle.destroy(); handle = null; }
      }
    };
    global.Cases.register({
      id: def.id, sceneId: def.sceneId, title: def.title,
      version: def.version || '1.0.0', updated: def.updated,
      methods: def.methods || (global.ATLAS.index.byScene[def.sceneId] || {}).methods || [],
      status: 'ready', imported: false, tabs: tabs
    });
  });
})(window);
