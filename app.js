// ---[ MODULE IMPORTS ]---------------------------------------------------------------------------

var basicAuth = require("basic-auth");
var bodyParser = require("body-parser");
var express = require("express");
var csv = require("csv-express");
var guid = require("guid");
var mongoose = require("mongoose");
var nconf = require("nconf");
var turk = require("./turk");
var Assignment = require("./app/models/assignment");
var HIT = require("./app/models/hit");
var Preview = require("./app/models/preview");
var Reassign = require("./app/models/reassign");
var SimulatorAssignment = require("./app/models/simulator-assignment");
var Condition = require("./conditions");
var { totalEarnings, totalScore, calculateBonus, getScore, scoreForPrediction, totalTaskScore, totalExperimentScore } = require("./client/js/price");


// ---[ CONFIGURATION ]----------------------------------------------------------------------------

nconf.argv().env('__');
nconf.file({ file: __dirname + "/config.json" });
nconf.defaults({
  db: {
    url: process.env.ORMONGO_RS_URL,
    username: process.env.DATABASE_USERNAME || "interface",
    name: process.env.DATABASE_NAME || "interface",
    password: process.env.DATABASE_PASSWORD || process.env.AWS_ACCESS_KEY_SECRET,
  },
  http: { port: process.env.PORT || 8080 , baseUrl: (process.env.HEROKU_APP_NAME ? (process.env.HEROKU_APP_NAME) + ".herokuapp.com/" : false) || "https://localhost:8080" },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
  },
  admin: { redirect: process.env.ADMIN_REDIRECT === "false" ? false : true, password: process.env.ADMIN_PASSWORD }
});
nconf.required([]);

var PORT = nconf.get("http:port");

// ---[ DATABASE CONNECTION ]--------------------------------------------------

mongoose.Promise = global.Promise;
mongoose.connect(nconf.get("db:url"), {
  useMongoClient: true,
  dbName: nconf.get("db:name"),
  authSource: nconf.get("db:name"),
  auth: {
    user: nconf.get("db:username"),
    password: nconf.get("db:password"),
  }
});

// ---[ EXPRESS SETUP ]----------------------------------------------------------------------------

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---[ AUTHENTICATION ]---------------------------------------------------------------------------

var auth = function (req, res, next) {
  var unauthorized = function (res) {
    res.set("WWW-Authenticate", "Basic realm=Authorization Required");
    return res.status(401).send();
  };
  var user = basicAuth(req);
  if (
    !user ||
    user.name !== "admin" ||
    user.pass !== nconf.get("admin:password")
  )
    return unauthorized(res);
  return next();
};

app.use("/admin", auth);

// ---[ STATIC ROUTES ]----------------------------------------------------------------------------

if (nconf.get("admin:redirect")) {
  app.route("/").get(function (req, res) { res.status(302).redirect("/admin") })
}

app.use(express.static(__dirname + "/dist", { extensions: ["html"] }));

// ---[ TURK SETUP ]-------------------------------------------------------------------------------

var getTurk = function (sandbox) {
  return new turk.Client({
    accessKey: nconf.get("aws:accessKeyId"),
    secret: nconf.get("aws:secretAccessKey"),
    sandbox: sandbox == true,
  });
};

// ---[ AJAX ROUTES ]------------------------------------------------------------------------------

var api = express.Router();
app.use("/", api);

api.route("/balance").get(auth, function (req, res) {
  getTurk(req.query.sandbox)
    .GetAccountBalance()
    .then(
      function (data) {
        res.send(data);
      },
      function (err) {
        console.log(err);
        res.status(502).send({ messages: [err] });
      }
    );
});

api.route("/previews").put(function (req, res) {
  new Preview({
    hitId: req.query.hitId,
    ipAddress: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userAgent: req.headers["user-agent"],
    workerId: req.query.workerId,
    previewTime: new Date(),
  }).save(function (err) {
    res.status(200).send();
  });
});

api
  .route("/hits")
  .get(auth, function (req, res) {
    HIT.find()
      .sort({ creationTime: 1 })
      .exec(function (err, hits) {
        if (!err) {
          res.json(hits);
        } else {
          res.status(502).send({ messages: [err] });
        }
      });
  })
  .put(auth, function (req, res) {
    getTurk(req.body.sandbox)
      .CreateHIT({
        title: req.body.title,
        description: req.body.description,
        height: 400,
        url: ("https://" + req.headers.host) + "/experiment",
        lifetime: Number(req.body.lifetime),
        duration: Number(req.body.duration),
        count: Number(req.body.assignments),
        reward: Number(req.body.basePayment),
      })
      .then(
        function (data) {
          if (data.HIT?.Request?.Errors) {
            var messages = [data.Request.Errors.Error[0].Message];
            res.status(502).send({ messages: messages });
          } else {
            new HIT({
              _id: data.HIT.HITId,
              title: req.body.title,
              description: req.body.description,
              internalName: req.body.internalName,
              lifetime: Number(req.body.lifetime),
              duration: Number(req.body.duration),
              assignments: Number(req.body.assignments),
              conditions: req.body.conditions,
              sandbox: req.body.sandbox == true,
              creationTime: new Date(),
              basePayment: Number(req.body.basePayment),
            }).save(function (err) {
              if (!err) {
                res.json({ hitId: data.HIT.HITId });
              } else {
                res.status(502).send({ messages: [err] });
              }
            });
          }
        },
        function (err) {
          console.log("err");
          console.log(err);
          res.status(502);
        }
      );
  });

api
  .route("/hits/:hitId")
  .get(function (req, res) {
    HIT.findOne(
      {
        _id: req.params.hitId,
      },
      function (err, data) {
        if (err) res.status(502).send({ messages: [err] });
        else if (!data) res.status(404).send();
        else res.json(data);
      }
    );
  })
  .delete(auth, function (req, res) {
    Assignment.remove(
      {
        _hitId: req.params.hitId,
      },
      function (err) {
        if (err) res.status(502).send({ messages: [err] });
        else {
          HIT.remove(
            {
              _id: req.params.hitId,
            },
            function (err) {
              if (err) res.status(502).send({ messages: [err] });
              else res.status(200).send();
            }
          );
        }
      }
    );
  });

api.route("/hits/:hitId/csv/detail").get(function (req, res) {
  HIT.findOne(
    {
      _id: req.params.hitId,
    },
    function (err, hit) {
      if (err) {
        res.status(502).send({ messages: [err] });
        return;
      } else if (!hit) {
        res.status(404).send();
      }
      Assignment.find({
        _hitId: req.params.hitId,
      })
        .sort({ completionTime: 1 })
        .exec(function (err, assignments) {
          if (err) {
            res.status(502).send({ messages: [err] });
            return;
          }
          var hdr = [];
          var rows = [hdr];
          hdr.push("AssignmentId");
          hdr.push("Task #");
          hdr.push("Round");
          hdr.push("Phase");
          hdr.push("Actual");
          hdr.push("StartTime");
          hdr.push("PredictionA_value");
          hdr.push("PredictionA_time");
          hdr.push("PredictionA_score");
          hdr.push("PredictionB_value");
          hdr.push("PredictionB_time");
          hdr.push("PredictionB_score");
          hdr.push("PredictionLong_value");
          hdr.push("PredictionLong_time");
          hdr.push("PredictionLong_score");
          hdr.push("Task total");
          hdr.push("Experiment total");
          hdr.push("EndTime");
          for (var i = 0; i < assignments.length; ++i) {
            var a = assignments[i];
            if (!a.completionTime) continue;
            var last = 0;
            for (var t = 0; t < a.tasks.length; t += 1) {
              let task = a.tasks[t];
              for (var j = 0; j < a.values[t].length; ++j) {
                const currentRound = j - 40 + (j - 40 >= 0 ? 1 : 0);
                var row = [];
                rows.push(row);
                // Assignmentid
                row.push(a._id);
                // Task No
                row.push(t + 1);
                // Round
                row.push(currentRound);
                // Phase
                let phase = "";
                if (currentRound < 0) {
                  phase = "Pre-task";
                } else if (currentRound <= task.trainingRounds) {
                  phase = "Training";
                } else if (
                  currentRound <=
                  task.trainingRounds + task.testingRounds
                ) {
                  phase = "Testing";
                } else {
                  phase = "Post-task";
                }
                row.push(phase);
                // Realization value (t + 1)
                row.push(a.values[t][j].toFixed(2));
                // Start time
                row.push(
                  phase === "Testing" || phase === "Training" ? last : ""
                );
                last = a.predictionTimes[t][3 * (j - 40) + 2] ?? last;
                // Prediction A value
                row.push(a.predictions[t][2 * (j - 40) + 0] ?? "")?.toFixed(2);
                // Prediction A time
                row.push(a.predictionTimes[t][3 * (j - 40) + 0] ?? "");
                // Prediction A score
                row.push(
                  phase === "Training" || phase === "Testing"
                    ? getScore(
                        j - 40,
                        a.predictions[t],
                        a.values[t],
                        task
                      )[0] || 0
                    : ""
                );
                // Prediction B value
                row.push(a.predictions[t][2 * (j - 40) + 1] ?? "")?.toFixed(2);
                // Prediction B time
                row.push(a.predictionTimes[t][3 * (j - 40) + 1] ?? "");
                // Prediction B score
                row.push(
                  phase === "Training" || phase === "Testing"
                    ? getScore(
                        j - 40,
                        a.predictions[t],
                        a.values[t],
                        task
                      )[1] || 0
                    : ""
                );
                // Long run average value
                row.push(
                  (phase === "Training" || phase === "Testing") &&
                    a.tasks[t].predictLongRunning
                    ? a.longRunningAveragePredHist?.[t]?.[j - 40]?.toFixed(2) ||
                        ""
                    : ""
                );
                // Long run average time
                row.push(
                  (phase === "Training" || phase === "Testing") &&
                    a.tasks[t].predictLongRunning
                    ? a.longRunningAveragePredTimingHist?.[t]?.[
                        j - 40
                      ]?.toFixed(2) || ""
                    : ""
                );

                // Long run average score
                row.push(
                  (phase === "Training" || phase === "Testing") &&
                    a.tasks[t].predictLongRunning
                    ? scoreForPrediction(
                        a.tasks[t],
                        a.longRunningAveragePredHist?.[t]?.[j - 40] || 0,
                        0
                      )
                    : ""
                );
                // Task total
                row.push(
                  j === (a.values[t].length - 1) ? totalTaskScore(t, a) : ''
                );
                // Experiment total
                row.push(
                  t ===  (a.tasks.length - 1) && j === (a.values[t].length - 1) ? totalExperimentScore(a) : ''
                );
                // End time
                row.push(
                  phase === "Training" || phase === "Testing" ? last : ""
                );
              }
            }
          }
          res.header(
            "Content-Disposition",
            "attachment; filename=" + hit._id + "-detail.csv"
          );
          res.csv(rows);
        });
    }
  );
});

api.route("/hits/:hitId/bonusPayments").get(async function (req, res) {
  const hit = await HIT.findOne({ _id: req.params.hitId });
  const turk = getTurk(hit.sandbox);
  const assignments = await turk.GetAssignmentsForHIT(req.params.hitId);
  var hdr = [];
  var rows = [hdr];
  hdr.push(
    "AssignmentId",
    "WorkerId",
    "Payment",
    "Status",
  );

  for (const assignment of assignments.Assignments) {
    const assignmentData = await Assignment.findOne({ _id: assignment.AssignmentId });
    const row = []
    row.push(
      assignment.AssignmentId,
      assignment.WorkerId,
      "$" +
        totalEarnings(
          assignmentData,
        ).toFixed(2),
      assignment.AssignmentStatus
    );
    rows.push(row);
  }
  res.header(
    "Content-Disposition",
    "attachment; filename=" + hit._id + "-bonus.csv"
  );
  res.csv(rows);
});

api.route("/hits/:hitId/csv/overview").get(function (req, res) {
  HIT.findOne(
    {
      _id: req.params.hitId,
    },
    function (err, hit) {
      if (err) {
        res.status(502).send({ messages: [err] });
        return;
      } else if (!hit) {
        res.status(404).send();
      }
      Assignment.find({
        _hitId: req.params.hitId,
      })
        .sort({ completionTime: 1 })
        .exec(function (err, assignments) {
          if (err) {
            res.status(502).send({ messages: [err] });
            return;
          }
          var hdr = [];
          var rows = [hdr];
          hdr.push("AssignmentId");
          hdr.push("WorkerId");
          hdr.push("Condition");
          hdr.push("Task #");
          hdr.push("Rho");
          hdr.push("Sigma");
          hdr.push("Mu");
          hdr.push("Forecasts");
          hdr.push("Score");
          hdr.push("Total score");
          hdr.push("Bonus");
          hdr.push("Total bonus");
          hdr.push("StartTime");
          hdr.push("EndTime");
          hdr.push("ConsentFormTime");
          hdr.push("InstructionPageTime");
          hdr.push("ExperimentTime");
          hdr.push("SurveyTime");
          hdr.push("UserAgent");
          hdr.push("IP");
          hdr.push("Validation");
          hdr.push("Gender");
          hdr.push("Age");
          hdr.push("Degree");
          hdr.push("StatsClasses");
          hdr.push("InvestmentExperience");
          hdr.push("MedianChallenge");
          hdr.push("HospitalChallenge");
          hdr.push("CoinTossChallenge");
          hdr.push("InvestWhen");
          hdr.push("Feedback");
          for (var i = 0; i < assignments.length; ++i) {
            var a = assignments[i];
            var c = Condition[a.condition];
            if (!a.completionTime) continue;
            var d = {};
            for (var j = 0; j < a.surveyData.length; ++j) {
              var tokens = a.surveyData[j].split("=", 2);
              d[tokens[0]] = tokens[1];
            }
            
            a.tasks.forEach((task, taskN) => {
              var row = [];
              rows.push(row);
              row.push(a._id);
              row.push(a.workerId);
              row.push(a.condition);
              row.push(taskN + 1);
              row.push(task.rho);
              row.push(task.sigma);
              row.push(task.mu);
              row.push(task.forecastMode);
              row.push(totalTaskScore(taskN, a));
              row.push(totalScore(a));
              row.push("$" + calculateBonus(totalTaskScore(taskN, a), task).toFixed(2));
              row.push("$" + totalEarnings(a).toFixed(2));
              row.push(a.startTime);
              row.push(a.completionTime);
              row.push(a.consentTime);
              row.push(a.instructionTime);
              row.push(a.experimentTime);
              row.push(a.surveyTime);
              row.push(a.userAgent);
              row.push(a.ipAddress);
              row.push(a.validation?.[taskN] ?? '');
              row.push(d.gender || "");
              row.push(d.age ? Number(d.age) : 0);
              row.push(d.degree || "");
              row.push(d.statsClasses || "");
              row.push(d.investmentExperience || "");
              row.push(d.medianChallenge ? Number(d.medianChallenge) : 0);
              row.push(d.hospitalChallenge || "");
              row.push(d.coinTossChallenge || "");
              row.push(d.investWhen || "");
              var f = d.feedback || "";
              f = f.replace("\t", " ");
              f = f.replace("\n", " | ");
              f = f.replace("\r", " | ");
              f = f.replace(",", ";");
              row.push(f);
            });            
          }
          res.header(
            "Content-Disposition",
            "attachment; filename=" + hit._id + "-overview.csv"
          );
          res.csv(rows);
        });
    }
  );
});

api.route("/hits/:hitId/approve/:really").post(auth, function (req, res) {
  var hitId = req.params.hitId;
  var really = req.params.really === "1";
  HIT.findOne(
    {
      _id: hitId,
    },
    function (err, hit) {
      if (err) res.status(502).send({ messages: [err] });
      else if (!hit) res.status(404).send();
      else {
        Assignment.find({ _hitId: hitId })
          .sort({ completionTime: 1 })
          .exec(function (err, assignments) {
            if (err) res.status(502).send({ messages: [err] });
            else {
              var assignmentsById = {};
              for (var i = 0; i < assignments.length; ++i) {
                assignmentsById[assignments[i]._id] = assignments[i];
              }
              var turk = getTurk(hit.sandbox);
              turk.GetAssignmentsForHIT(hitId).then(
                function (data) {
                  var result = [];
                  if (!data.Assignments) {
                    res.status(200).send(result);
                    return;
                  }
                  var ae = data.Assignments;
                  for (var i = 0; i < ae.length; ++i) {
                    var a = ae[i];
                    var obj = {};
                    result.push(obj);
                    obj._id = a.AssignmentId;
                    obj.status = a.AssignmentStatus;
                    obj.workerId = a.WorkerId;
                    obj.basePayment = hit.basePayment;
                    if (assignmentsById[a.AssignmentId]) {
                      var aa = assignmentsById[a.AssignmentId];
                      obj.score = totalScore(aa);
                      obj.bonusPayment = totalEarnings(aa);
                      obj.condition = aa.condition;
                      if (aa.completionTime) {
                        obj.duration =
                          (aa.completionTime.getTime() -
                            aa.startTime.getTime()) /
                          1000.0;
                      }
                    } else {
                      obj.status += " / NO_DB_RECORD";
                    }
                  }
                  if (really) {
                    (function () {
                      var i = 0,
                        j = 0;
                      var bonusNext = function () {
                        while (i < result.length) {
                          if (
                            result[i].status === "Submitted" &&
                            result[i].bonusPayment > 0
                          ) {
                            turk
                              .GrantBonus(
                                result[i]._id,
                                result[i].workerId,
                                result[i].bonusPayment
                              )
                              .then(
                                function () {
                                  bonusNext();
                                },
                                function (err) {
                                  console.error(err);
                                  bonusNext();
                                }
                              );
                            ++i;
                            return;
                          }
                          ++i;
                        }
                      };
                      var approveNext = function () {
                        while (j < result.length) {
                          if (result[j].status === "Submitted") {
                            turk.ApproveAssignment(result[j]._id).then(
                              function () {
                                approveNext();
                              },
                              function (err) {
                                console.error(err);
                                approveNext();
                              }
                            );
                            ++j;
                            return;
                          }
                          ++j;
                        }
                      };
                      approveNext();
                      bonusNext();
                    })();
                  }
                  res.status(200).send(result);
                },
                function (err) {
                  res.status(502).send({ messages: [err] });
                }
              );
            }
          });
      }
    }
  );
});

api
  .route("/hits/:hitId/assignments/:assignmentId/reassign")
  .post(function (req, res) {
    Assignment.findOne(
      {
        _id: req.params.assignmentId,
      },
      function (err, assignment) {
        if (err) res.status(502).send({ messages: [err] });
        else if (!assignment) res.status(404).send();
        else {
          var when = new Date();
          new Reassign({
            hitId: req.params.hitId,
            assignmentId: req.params.assignmentId,
            oldWorkerId: assignment.workerId,
            oldIpAddress: assignment.ipAddress,
            oldUserAgent: assignment.userAgent,
            oldStartTime: assignment.startTime,
            newWorkerId: req.body.workerId,
            newIpAddress:
              req.headers["x-forwarded-for"] || req.connection.remoteAddress,
            newUserAgent: req.headers["user-agent"],
            newStartTime: when,
          }).save();
          assignment.workerId = req.body.workerId;
          assignment.ipAddress =
            req.headers["x-forwarded-for"] || req.connection.remoteAddress;
          assignment.userAgent = req.headers["user-agent"];
          assignment.startTime = when;
          assignment.save(function (err) {
            if (err) res.status(502).send({ messages: [err] });
            else res.status(200).send({ token: assignment.token });
          });
        }
      }
    );
  });

api
  .route("/hits/:hitId/assignments/:assignmentId/complete")
  .post(async function (req, res) {
    const AssignmentModel = req.body.isSimulated
      ? SimulatorAssignment
      : Assignment;

    if (req.body.isSimulated) {
      const assignment = new AssignmentModel({
        _id: "simulated_" + guid.raw(),
        _hitId: "simulated",
        workerId: "simulated_" + guid.raw(),
        ipAddress:
          req.headers["x-forwarded-for"] || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        condition: req.body.condition ?? 'simulated',
        startTime: req.body.simulatedStart ?? new Date(),
      });
      await assignment.save();
      req.params.assignmentId = assignment._id;
    }

    AssignmentModel.findOne(
      {
        _id: req.params.assignmentId,
      },
      function (err, assignment) {
        if (err) res.status(502).send({ messages: [err] });
        else if (!assignment) res.status(404).send();
        else {
          if (!assignment.completionTime) {
            assignment.completionTime = new Date();
            assignment.token = guid.raw();
            assignment.tasks = req.body.tasks;
            assignment.values = req.body.values;
            assignment.validation = req.body.validationSurvey;
            assignment.predictions = req.body.predictions;
            assignment.consentTime = req.body.consentTime;
            assignment.longRunningAveragePredHist = req.body.longRunningAveragePredHist;
            assignment.longRunningAveragePredTimingHist =
              req.body.longRunningAveragePredTimingHist;
            assignment.instructionTime = req.body.instructionTime;
            assignment.predictionTimes = req.body.predictionTimes;
            assignment.experimentTime = req.body.experimentTime;
            assignment.surveyTime = req.body.surveyTime;
            assignment.surveyData = req.body.surveyData;
          }
          assignment.save(function (err) {
            if (err) res.status(502).send({ messages: [err] });
            else res.status(200).send({ token: assignment.token });
          });
        }
      }
    );
  });

api.route("/hits/:hitId/assignments").get(auth, function (req, res) {
  Assignment.find({
    _hitId: req.params.hitId,
  })
    .sort({ completionTime: -1 })
    .exec(function (err, assignments) {
      if (!err) {
        res.json(
          assignments.map(a => ({
            ...a.toObject(),
            bonusPayment: totalEarnings(a)
          }))
        );
      } else {
        res.status(502).send({ messages: [err] });
      }
    });
});

api
  .route("/hits/:hitId/assignments/:assignmentId")
  .get(function (req, res) {
    Assignment.findOne(
      {
        _id: req.params.assignmentId,
      },
      function (err, data) {
        if (err) res.status(502).send({ messages: [err] });
        else if (!data) res.status(404).send();
        else res.json(data);
      }
    );
  })
  .put(function (req, res) {
    HIT.findOne(
      {
        _id: req.params.hitId,
      },
      function (err, hit) {
        if (err) res.status(502).send({ messages: [err] });
        else if (!hit) res.status(404).send();
        else {
          Assignment.find({
            workerId: req.body.workerId,
          })
            .sort({ completionTime: 1 })
            .exec(function (err, assignments) {
              if (err) res.status(502).send({ messages: [err] });
              else if (assignments.length > 0) {
                res.status(409).send();
                return;
              }
              var condition =
                hit.conditions[
                  Math.floor(Math.random() * hit.conditions.length)
                ];
              var assignment = new Assignment({
                _id: req.params.assignmentId,
                _hitId: req.params.hitId,
                workerId: req.body.workerId,
                ipAddress:
                  req.headers["x-forwarded-for"] ||
                  req.connection.remoteAddress,
                userAgent: req.headers["user-agent"],
                condition: condition,
                startTime: new Date(),
              });
              assignment.save(function (err) {
                if (!err) {
                  res.status(200).json(assignment);
                } else {
                  res.status(502).send({ messages: [err] });
                }
              });
            });
        }
      }
    );
  });

api.route("/conditions").get(function (req, res) {
  res.json(Condition);
});

api.route("/conditions/:conditionId").get(function (req, res) {
  if (Condition[req.params.conditionId]) {
    res.json(Condition[req.params.conditionId]);
  } else {
    res.status(404).send();
  }
});

// ---[ APP START ]------------------------------------------------------------

app.listen(PORT);
console.log("Listening on port " + PORT);
