var {
  MTurkClient,
  CreateHITCommand,
  GetAccountBalanceCommand,
  ListAssignmentsForHITCommand,
  GetHITCommand,
  SendBonusCommand,
  RejectAssignmentCommand,
  UpdateHITReviewStatusCommand,
  ApproveAssignmentCommand,
} = require("@aws-sdk/client-mturk");

exports.Client = function (options) {
  var accessKey = options.accessKey;
  var secret = options.secret;
  var sandbox = options.sandbox;
  const client = new MTurkClient({
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secret,
    },
    region: "us-east-1",
    endpoint: sandbox
      ? "https://mturk-requester-sandbox.us-east-1.amazonaws.com"
      : "https://mturk-requester.us-east-1.amazonaws.com",
  });

  this.ApproveAssignment = function (assignmentId) {
    return client.send(
      new ApproveAssignmentCommand({
        AssignmentId: assignmentId,
      })
    );
  };

  this.CreateHIT = function (args) {
    var ns =
      "http://mechanicalturk.amazonaws.com" +
      "/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd";
    const operation = new CreateHITCommand({
      Title: args.title,
      Description: args.description,
      Question:
        '<ExternalQuestion xmlns="' +
        ns +
        '"><ExternalURL>' +
        args.url +
        "</ExternalURL><FrameHeight>" +
        args.height +
        "</FrameHeight></ExternalQuestion>",
      AssignmentDurationInSeconds: args.duration,
      LifetimeInSeconds: args.lifetime,
      QualificationRequirement: sandbox ? [] : [
        {
          QualificationTypeId: "00000000000000000071",
          Comparator: "EqualTo",
          LocaleValue: { Country: "US" },
        },
        {
          QualificationTypeId: "000000000000000000L0",
          Comparator: "GreaterThanOrEqualTo",
          IntegerValue: "95",
        },
      ],
      MaxAssignments: args.count,
      Reward: String(args.reward),
    });
    return client.send(operation);
  };

  this.GetAccountBalance = function () {
    return client.send(new GetAccountBalanceCommand());
  };

  this.GetAssignmentsForHIT = async function (hitId) {

    let result;
    let assignments = [];
    do {
      result = await client.send(
        new ListAssignmentsForHITCommand({
          HITId: hitId,
          MaxResults: 100,
          NextToken: result && result.NextToken,
  
        })
      );
      console.log('more', result);
      assignments = [...assignments, ...result.Assignments];
    } while (result.NextToken);
    
    return { Assignments: assignments };
  };

  this.GetHIT = function (hitId) {
    return client.send(
      new GetHITCommand({
        HITId: hitId,
      })
    );
  };

  this.GrantBonus = function (assignmentId, workerId, amount) {
    return client.send(
      new SendBonusCommand({
        AssignmentId: assignmentId,
        WorkerId: workerId,
        BonusAmount: amount.toFixed(2),
        Reason: "Bonus based on prediction score during experiment",
        UniqueRequestToken: assignmentId,
      })
    );
  };

  this.RejectAssignment = function (assignmentId) {
    return client.send(
      new RejectAssignmentCommand({
        AssignmentId: assignmentId,
      })
    );
  };

  this.SetHITAsReviewing = function (hitId) {
    return client.send(
      new UpdateHITReviewStatusCommand({
        HITId: hitId,
        Revert: false,
      })
    );
  };
};
