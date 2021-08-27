window.onload = () => {
    console.warn('我在幹嘛我怎麼還不去工作????');
    var script = document.currentScript;
    var chara_name = document.querySelector("script[data-chara]").getAttribute("data-chara");
    var chara_container = document.querySelector("#chara_container");
    var chara = document.querySelector("#chara");
    var chara_pop = document.querySelector("#chara_pop");
    var pop_count = 0;
    var counter = document.querySelector("#counter");
    var sound = new Howl({ src: JSON.parse(document.querySelector("script[data-sound]").getAttribute("data-sound")) });

    function pop() {
        playSound();
        chara.setAttribute("style", "visibility: hidden;");
        chara_pop.setAttribute("style", "visibility: unset;");
    }

    function unpop() {
        chara_pop.setAttribute("style", "visibility: hidden;");
        chara.setAttribute("style", "visibility: unset;");
    }

    var storage = {};
    var storage_suffix = chara_name === "no15" ? "" : "_" + chara_name
    storage.load = function() {
        var count = localStorage.getItem("pop_count" + storage_suffix);
        if (count !== null) {
            pop_count = parseInt(count);
            counter.innerHTML = pop_count;
        }
    };
    storage.save = function() {
        localStorage.setItem("pop_count" + storage_suffix, pop_count);
    }
    storage.id = function() {
        return localStorage.getItem("online_id");
    };
    storage.set_id = function(id) {
        localStorage.setItem("online_id", id);
    };

    var online = (function() {
        //var server = "s://scores.popleopardcat.saru.moe";
        var server = "s://scores-popleopardcat.test-endpoint.lan";
        var scope = "/" + chara_name;
        var self = {
            score: 0 // real online score
        };
        var ws = null;
        var online_id = storage.id();
        var start = Date.now();
        var next = start;
        var no = 0;
        var waiting = true;
        var score = 0;
        var salt = "";
        var hash = "";
        var hashes_start = 0;
        var hashes = [];
        var tasks = [];
        var task_runner = null;
        var task_last = start;

        var global_score = document.querySelector("#global_scores_text");
        var leaderboard = document.querySelector("#scores_leaderboard ol");
        var leaderboard_yourself = null;

        var yt_id = null;

        var gen_hashes = function(target_no, sec) {
            var idx = target_no - hashes_start;
            if (idx < 0) {
                return [];
            } else {
                return hashes[idx] = window.hash(hash, salt, score, sec, ws);
            }
        };
        self.connect = function(cb) {
            ws = new WebSocket("ws" + server + scope + "/submit");
            ws.onmessage = function(evt) {
                var args = evt.data.split(",");
                var cmd = args.shift();
                switch (cmd) {
                    case "init":
                        online_id = args[0]
                        storage.set_id(online_id);
                        self.score = score = parseInt(args[1]);
                        hash = args[2];
                        salt = args[3];
                        start = Date.now();
                        hashes_start = 0;
                        hashes = [];
                        tasks = [];
                        setup_task_runner();
                        waiting = false;
                        if (cb) cb();
                        break;
                    case "ack":
                        var sync_no = parseInt(args[0]);
                        var idx = sync_no - hashes_start;
                        hash = hashes[idx][parseInt(args[1])];
                        score = parseInt(args[2]);
                        self.score = parseInt(args[3]);
                        if (args[4]) salt = args[4];
                        hashes_start = sync_no + 1;
                        hashes = hashes.slice(sync_no + 1);
                        break;
                    case "sync":
                        hash = args[0];
                        hashes = [];
                        hashes_start = no + 1;
                        tasks = [];
                        self.score = score = parseInt(args[1]);
                        if (args[2]) salt = args[2];
                        self.count_up();
                        break;
                }
            };
            ws.onopen = function() {
                connected = true;
                if (online_id) ws.send("contiune," + online_id);
                else ws.send("new");
            };
            ws.onclose = function() {
                ws = null;
                waiting = true;
            }
        };

        function setup_task_runner() {
            if (task_runner) return;
            task_runner = setInterval(function() {
                var now = Date.now();
                if (tasks.length === 0) {
                    if (!ws) {
                        clearInterval(task_runner);
                        task_runner = null;
                    }
                } else if ((now - task_last) >= 3) {
                    task_last = now;
                    var task = tasks.shift();
                    task();
                }
            }, 3);
        };
        self.count_up = function() {
            if (!window.hash) return;
            if (!ws) self.connect(self.count_up);
            else if (!waiting) {
                no += 1;
                var local_no = no;
                tasks.push(function() {
                    if (ws) {
                        var sec = Math.floor((Date.now() - start) / 1000);
                        hs = gen_hashes(local_no, sec);
                        ws.send("count," + local_no + "," + hs.join(","));
                        hash = hs[2];
                        score += 1;
                        self.score += 1;

                        step_global_score();
                        step_leaderboard_yourself();
                    }
                });
            }
        };

        function format_score(score) {
            return score.toLocaleString('en-US', {
                useGrouping: true
            });
        };

        function update_global_score(score) {
            global_score.innerHTML = format_score(score);
        };

        function step_global_score() {
            update_global_score(parseInt(global_score.innerHTML.replaceAll(",", "")) + 1);
        };

        function step_leaderboard_yourself() {
            if (leaderboard_yourself) {
                leaderboard_yourself.innerHTML = format_score(parseInt(leaderboard_yourself.innerHTML.replace(",", "")) + 1);
            }
        };

        function update_leaderboard(top) {
            last_top = top;
            leaderboard.innerHTML = "";
            leaderboard_yourself = null;
            var leaderboard_yourself_tmp_id, leaderboard_yourself_tmp_yt;
            top.forEach(function(ele, idx) {
                var no = document.createElement("span");
                no.classList.add("no");
                switch (idx + 1) {
                    case 1:
                        no.innerHTML = "🥇";
                        break;
                    case 2:
                        no.innerHTML = "🥈";
                        break;
                    case 3:
                        no.innerHTML = "🥉";
                        break;
                    default:
                        no.innerHTML = idx + 1;
                        break;
                }
                var name = document.createElement("span");
                name.classList.add("name");
                if (ele.yt_name) {
                    name.innerHTML = ele.yt_name;
                } else {
                    name.innerHTML = "這是個低調的路人";
                }
                var score = document.createElement("span");
                score.classList.add("score");
                score.innerHTML = format_score(ele.score);
                if (ele.yt_id === yt_id) {
                    leaderboard_yourself_tmp_yt = {
                        "score": score,
                        "name": name
                    };
                }
                if (ele.id === online_id) {
                    leaderboard_yourself_tmp_id = {
                        "score": score,
                        "name": name
                    };
                }
                var li = document.createElement("li");
                li.append(no, name, score);
                leaderboard.append(li);
            });
            var leaderboard_yourself_tmp = leaderboard_yourself_tmp_yt || leaderboard_yourself_tmp_id;
            if (leaderboard_yourself_tmp) {
                leaderboard_yourself = leaderboard_yourself_tmp.score;
                leaderboard_yourself_tmp.name.innerHTML += "&nbsp;<span class=\"yourself\">↞&nbsp;你在這</span>"
            }
        };
        self.global = function(retry) {
            var gws = new WebSocket("ws" + server + scope + "/global");
            gws.onmessage = function(evt) {
                var json = JSON.parse(evt.data);
                update_global_score(json.score);
            };
            gws.onclose = function() {
                retry = (retry || -1) + 1;
                if (retry > 8) retry = 8;
                setTimeout(function() {
                    self.global(retry);
                }, Math.pow(2, retry));
            }
        };
        self.leaderboard = function(retry) {
            var lws = new WebSocket("ws" + server + scope + "/top/100");
            lws.onmessage = function(evt) {
                var json = JSON.parse(evt.data);
                //update_global_score(json.global.score);
                update_leaderboard(json.top);
            };
            lws.onclose = function() {
                retry = (retry || -1) + 1;
                if (retry > 8) retry = 8;
                setTimeout(function() {
                    self.leaderboard(retry);
                }, Math.pow(2, retry));
            }
        };

        self.update_yt = function(user) {
            if (user.isSignedIn()) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function() {
                    var json = JSON.parse(xhr.responseText);
                    yt_id = json.id;
                }
                xhr.open("POST", "http" + server + "/link/" + online_id + "/yt");
                xhr.send(user.getAuthResponse().access_token);
            }
        };

        return self;
    })();

    function isMobile() {
        try {
            document.createEvent("TouchEvent");
            return true;
        } catch (err) {
            return false;
        }
    }

    function playSound() {
        sound.play();
    }

    function count_up() {
        pop_count++;
        counter.innerHTML = pop_count;
        storage.save();
        online.count_up();
    }

    storage.load();
    setTimeout(online.global, 666);
    online.leaderboard();
    window.update_yt = online.update_yt;
    if (GoogleAuth) updateSigninStatus();

    var socres = document.querySelector("#scores");
    var scores_toggle = document.querySelector("#scores_toggle");
    var scores_leaderboard = document.querySelector("#scores_leaderboard");
    scores.addEventListener('click', function(e) {
        if (scores_toggle.classList.contains("show")) {
            scores_toggle.classList.remove("show");
            scores_leaderboard.classList.remove("show");
        } else {
            scores_toggle.classList.add("show");
            scores_leaderboard.classList.add("show");
        }
    });

    var chara_up = chara.getAttribute("data-up");
    var chara_normal = chara.getAttribute("src");

    if (isMobile()) {
        window.addEventListener("touchmove", function(e) {
            e.preventDefault();
        }, {
            passive: false
        });
        if (chara_up) chara.setAttribute("src", up);
        chara_container.addEventListener('touchstart', function(e) {
            count_up();
            pop();
        });
        chara_container.addEventListener('touchend', function(e) {
            unpop();
        });
    } else {
        if (chara_up) {
            chara_container.addEventListener('mouseover', function(e) {
                chara.setAttribute("src", chara_up);
            });
            chara_container.addEventListener('mouseout', function(e) {
                chara.setAttribute("src", chara_normal);
            });
        }

        //  點擊事件
        chara_container.addEventListener('mousedown', function(e) {
            count_up();
            pop();
        });
        chara_container.addEventListener('mouseup', function(e) {
            unpop();
        });

        //  鍵盤事件
        document.addEventListener('keydown', function(e) {
            pop();
        });
        document.addEventListener('keyup', function(e) {
            count_up();
            if (chara_up) chara.setAttribute("src", chara_up);
            unpop();
        });
    }
}

var GoogleAuth;
var socres_signin = document.querySelector("#scores_signin");
var socres_signedin = document.querySelector("#scores_signedin");
socres_signin.addEventListener('click', function(e) {
    if (GoogleAuth) GoogleAuth.signIn();
    e.stopPropagation();
});
socres_signedin.addEventListener('click', function(e) {
    if (GoogleAuth) GoogleAuth.signOut();
    e.stopPropagation();
});
window.handleClientLoad = function() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        'clientId': '46360894940-9sp8ubejnha6biluq3sdlnsc8ppmj6oj.apps.googleusercontent.com',
        'scope': 'https://www.googleapis.com/auth/youtube.readonly',
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
    }).then(function() {
        GoogleAuth = gapi.auth2.getAuthInstance();
        GoogleAuth.isSignedIn.listen(updateSigninStatus);
        updateSigninStatus();
    });
}

function updateSigninStatus() {
    var user = GoogleAuth.currentUser.get();
    if (user.isSignedIn()) {
        socres_signin.classList.remove("loaded");
        socres_signin.classList.add("signedin");
        socres_signedin.classList.add("signedin");
    } else {
        socres_signin.classList.add("loaded");
        socres_signedin.classList.remove("signedin");
    }
    update_yt(user);
}
