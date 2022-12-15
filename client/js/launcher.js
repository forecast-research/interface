import { getFromQueryString, getTasks } from './condition-schema';
import { fatalError, launchExperiment } from './experiment';
import consentTexts from './consent-texts'

function getHIT(serverHit) {
  return {
    assignmentId: getQueryStringParam("assignmentId"),
    hitId: getQueryStringParam("hitId"),
    turkSubmitTo: getQueryStringParam("turkSubmitTo"),
    workerId: getQueryStringParam("workerId"),
    basePayment: serverHit?.basePayment ?? null,
    offline: false,
    preview: false,
    skipIntro: false,
    details: serverHit ?? null,
  };
}

function getPreviewHIT(serverHit) {
  return {
    ...getHIT(serverHit),
    offline: false,
    skipIntro: false,
    preview: true,
    details: null,
  };
}

function getOfflineHIT() {
  return {
    skipIntro: getQueryStringParam("skipIntro") === "1",
    basePayment: Number(getQueryStringParam("basePayment", "1.00")),
    assignmentId: null,
    hitId: null,
    turkSubmitTo: null,
    workerId: null,
    offline: true,
    skipIntro: false,
    preview: false,
    details: null,
  };
}

function getLocalHIT(conditionId) {
  let basePayment = consentTexts[conditionId]?.basePayment ??  "1.00"

  return {
    skipIntro: getQueryStringParam("skipIntro") === "1",
    basePayment: Number(getQueryStringParam("basePayment", basePayment)),
    assignmentId: null,
    hitId: null,
    turkSubmitTo: null,
    workerId: null,
    offline: true,
    preview: false,
    local: true,
    details: null,
  };
}

function getHitTasksFromQueryString() {
  return getFromQueryString();
}

function getHitTasksForPreview() {
  return [{
    rho: 0.5,
    mu: 0,
    sigma: 20,
    seed: null,
    entryMode: "graphical",
    bonusDivisor: 750,
    trainingRounds: 0,
    testingRounds: 40,
    showGrayDots: true,
    colorDecay: false,
    listeningMaterial: false,
    showMean: true,
    clickt: false,
    clickt10: false,
    forecastMode: "1+2",
    context: null,
  }];
}

var loadHit = async function (hit) {
  return $.ajax({
    url: "../../hits/" + hit.hitId,
    type: "GET",
  })
    .promise()
    .catch((e) => {
      fatalError(
        "An error occurred attempting to retrieve " +
          "experiment details from the experiment database."
      );
      throw e;
    });
};

var loadAssignment = async function (hit) {
  return $.ajax({
    url: "../../hits/" + hit.hitId + "/assignments/" + hit.assignmentId,
    type: "GET",
  })
    .promise()
    .catch((e) => {
      if (e.status === 404) {
        return null;
      } else {
        fatalError(
          "An error occurred attempting to retrieve " +
            "experiment details from the experiment database."
        );
        throw e;
      }
    });
};

var loadCondition = async function (conditionId) {
  return $.ajax({
    url: "../../conditions/" + conditionId,
    type: "GET",
  })
    .promise()
    .catch((e) => {
      if (e.status === 409) {
        return null;
      } else {
        fatalError(
          "An error occurred attempting to retrieve " +
            "experiment parameter set " +
            conditionId +
            " from the experiment database."
        );
        throw e;
      }
    });
};

var createAssignment = async function (hit) {
  return $.ajax({
    url: "../../hits/" + hit.hitId + "/assignments/" + hit.assignmentId,
    type: "PUT",
    data: { workerId: hit.workerId },
  })
    .promise()
    .catch((jqXHR) => {
      if (jqXHR.status === 409)
        fatalError(
          "Our records indicate that you have already " +
            "participated in this experiment. We apologize and " +
            "ask that you return this HIT for another participant." +
            "Thank you for your prior participation!"
        );
      else
        fatalError(
          "An error occurred attempting to create an " +
            "experiment record in the database."
        );
      throw jqXHR;
    });
};

var reassignAssignment = async function (hit) {
  return $.ajax({
    url:
      "../../hits/" +
      hit.hitId +
      "/assignments/" +
      hit.assignmentId +
      "/reassign",
    type: "POST",
    data: { workerId: hit.workerId },
  })
    .promise()
    .catch((jqXHR) => {
      if (jqXHR.status === 409)
        fatalError(
          "Our records indicate that you have already " +
            "participated in this experiment. We apologize and " +
            "ask that you return this HIT for another participant." +
            "Thank you for your prior participation!"
        );
      else
        fatalError(
          "This assignment was previously started by a " +
            "different worker and then returned, and an error " +
            "occurred attempting to reassign the task."
        );
      throw jqXHR;
    });
};

var getQueryStringParam = function (name, defaultValue)
{
    if (defaultValue === undefined) defaultValue = null;
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++)
    {
        var pair = vars[i].split('=', 2);
        const paramName = decodeURIComponent(pair[0])
        const paramValue = decodeURIComponent(pair[1])
        if (paramName === name){
            return paramValue;
        }
    }
    return defaultValue;
};

var returnToTurk = function ({ offline, local, turkSubmitTo, assignmentId, token }) {

    if (offline || local)
    {
        window.alert('(OFFLINE MODE) Return to Turk; token: ' + hit.token);
    }

    else
    {
        var form = document.createElement('form');
        var assignmentIdInput = document.createElement('input');
        var tokenInput = document.createElement('input');
        form.method = 'POST';
        form.action = turkSubmitTo + '/mturk/externalSubmit';
        assignmentIdInput.name = 'assignmentId';
        assignmentIdInput.value = assignmentId;
        tokenInput.name = 'token';
        tokenInput.value = token;
        form.appendChild(assignmentIdInput);
        form.appendChild(tokenInput);
        document.body.appendChild(form);
        form.submit();
    }
};

var bootstrap = async function () {
  if (getQueryStringParam("offline")) {
    $("body").addClass("is-simulation");
    // Offline mode - take UI behavior parameters from query string
    const hit = getOfflineHIT();
    const tasks = getTasks(getHitTasksFromQueryString());
    const result = await launchExperiment(
      tasks,
      hit.basePayment,
      hit.preview,
      hit.skipIntro,
      "",
    );
    console.log("Experiment result", result);
  }

  //Local version != Offline (We get the condition and we apply its values)
  else if (getQueryStringParam("local")) {
    $("body").addClass("is-simulation");
    const simulatedStart = new Date();
    const loadConditionId = getQueryStringParam("condition");
    const hit = getLocalHIT(loadConditionId);
    const tasks = getTasks(await loadCondition(loadConditionId));
    const result = await launchExperiment(
      tasks,
      hit.basePayment,
      hit.preview,
      hit.skipIntro,
      loadConditionId,
    );
    await $.ajax({
      url:
        "hits/" +
        hit.hitId +
        "/assignments/" +
        hit.assignmentId +
        "/complete?rhoValue=",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        ...result,
        tasks,
        condition: loadConditionId,
        isSimulated: true,
        simulatedStart,
      }),
    })
      .promise()
      .catch((e) => {
        fatalError("An error occurred attempting to submit the results.");
        throw e;
      });
    window.alert(
      "Offline mode; data will not be saved (see " +
        "console for data that would be saved)"
    );
    console.log(result);
  } else if (
    getQueryStringParam("assignmentId") === "ASSIGNMENT_ID_NOT_AVAILABLE"
  ) {
    $.ajax({
      url: "previews?" + window.location.search.substring(1),
      type: "PUT",
    });

    // Preview mode - default UI behavior parameters but load
    // data from the HIT from the back-end
    const localHit = getPreviewHIT();
    const hit = getHIT(await loadHit(localHit));
    const tasks = getTasks(getHitTasksForPreview());
    await launchExperiment(
      tasks,
      hit.basePayment,
      localHit.preview,
      hit.skipIntro,
      "S1",
    );
  } else {
    // Normal mode - Get all parameters from the back-end
    const localHit = getHIT();
    if (!localHit.assignmentId || !localHit.hitId || !localHit.turkSubmitTo || !localHit.workerId) {
      fatalError("Required query string parameters are missing.");
      return;
    }

    const hit = getHIT(await loadHit(localHit));

    let assignment = await loadAssignment(hit);
    if (!assignment) {
      assignment = await createAssignment(hit);
    } else if (assignment.workerId !== hit.workerId) {
      assignment = await reassignAssignment(hit);
    } else if (assignment.completionTime) {
      assignment = null;
      returnToTurk({
        ...hit,
        token: assignment.token,
      });
    }

    if (!assignment) {
      return;
    }

    const tasks = getTasks(await loadCondition(assignment.condition));
    const result = await launchExperiment(tasks, hit.basePayment, hit.preview, hit.skipIntro, assignment.condition);
    const tokenResponse = await $.ajax({
      url:
        "hits/" +
        hit.hitId +
        "/assignments/" +
        hit.assignmentId +
        "/complete?rhoValue=",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        ...result,
        tasks,
      }),
    })
      .promise()
      .catch((e) => {
        fatalError("An error occurred attempting to submit the results.");
        throw e;
      });
    returnToTurk({
      ...hit,
      token: tokenResponse.token,
    });
  }
};

$(function ()
{
    try {
      bootstrap();
    } catch {}
});