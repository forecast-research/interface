import { toQueryString, getTasks } from "./condition-schema";

function renderConditionTasks(conditions) {
  for (var name in conditions) {
    if (!conditions.hasOwnProperty(name)) continue;
    var condition = conditions[name];
    var tasks = getTasks(condition);
    for (var i = 0; i < tasks.length; i++) {
      var row = $(
        i > 0 ? '<tr class="task-row-start">' : '<tr class="condition-row-start">'
      ).appendTo("#conditions tbody");
      var task = tasks[i];
      row.append($("<td>").text(i === 0 ? name : ""));
      row.append(
        $("<td>").html(
          i === 0
            ? `<a href="/experiment.html?local=1&condition=${name}">Simulate</a>`
            : ""
        )
      );
      row.append($("<td>").text(task.rho));
      row.append($("<td>").text(task.mu));
      row.append($("<td>").text(task.sigma));      
      row.append($("<td>").text(task.bonusDivisor));
      row.append($("<td>").text(task.testingRounds));
      row.append($("<td>").text(task.forecastMode));

    }
  }
}

$(function () {
  $.ajax({
    url: "../../conditions",
    type: "GET",
    success: function (conditions) {
      renderConditionTasks(conditions);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      var body = $(document.body);
      body.append('<h2 class="err">Error</h2>');
      if (jqXHR.status === 502) {
        var messages = jqXHR.responseJSON.messages;
        var ul = $("<ul>").appendTo(body);
        for (var i = 0; i < messages.length; ++i) {
          ul.append($("<li>").text(messages[i]));
        }
      } else {
        var msg = textStatus;
        if (errorThrown) msg += ": " + errorThrown;
        body.append($("<p>").text(msg));
      }
    },
  });
});
