"use client";

import { useState, useEffect, useCallback } from "react";
import { startRecording, stopRecording } from "./utils/recognition";
import { evaluateAnswer } from "./utils/openai";
import { QuestionSession } from "./types/practice";
import { SplashCursor } from "./components/Splash";

import questionsData from "./questions.json";

interface Message {
  text: string;
  isQuestion: boolean;
  isEvaluation?: boolean;
  score?: number;
}

// Get all questions with their metadata
const practiceQuestions = (questionsData as any[]).map((q) => ({
  id: q.id,
  question: q.question,
  level: q.level,
  suggested_answer: q.suggested_answer,
}));

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionSessions, setQuestionSessions] = useState<QuestionSession[]>(
    []
  );
  const [totalScore, setTotalScore] = useState(0);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showSuggestedAnswer, setShowSuggestedAnswer] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const startPractice = () => {
    setTimeout(() => {
      setIsPracticeMode(true);
      const firstQuestion = practiceQuestions[0];
      setCurrentQuestion(firstQuestion.question);
      setMessages([{ text: firstQuestion.question, isQuestion: true }]);
      setQuestionSessions([
        {
          question: firstQuestion.question,
          answers: [],
          score: 0,
          followUpCount: 0,
          isDone: false,
        },
      ]);
    }, 300);
  };

  const getCurrentSession = () => {
    return questionSessions[currentQuestionIndex];
  };

  const updateCurrentSession = (updatedSession: QuestionSession) => {
    setQuestionSessions((prev) => {
      const newSessions = [...prev];
      newSessions[currentQuestionIndex] = updatedSession;
      return newSessions;
    });
  };

  const calculateFinalScore = () => {
    const totalQuestions = questionSessions.length;
    const sumScores = questionSessions.reduce(
      (sum, session) => sum + session.score,
      0
    );
    return Math.round(sumScores / totalQuestions);
  };

  const nextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    setShowSuggestedAnswer(false);
    if (nextIndex >= practiceQuestions.length) {
      // Practice is complete
      setShowFinalScore(true);
      setTotalScore(calculateFinalScore());
      return;
    }

    const nextQuestion = practiceQuestions[nextIndex];
    setCurrentQuestionIndex(nextIndex);
    setCurrentQuestion(nextQuestion.question);
    setMessages((prev) => [
      ...prev,
      { text: nextQuestion.question, isQuestion: true },
    ]);

    // Initialize next question session if it doesn't exist
    if (!questionSessions[nextIndex]) {
      setQuestionSessions((prev) => [
        ...prev,
        {
          question: nextQuestion.question,
          answers: [],
          score: 0,
          followUpCount: 0,
          isDone: false,
        },
      ]);
    }
  };

  const handleEvaluation = async (answer: string) => {
    setIsEvaluating(true);
    try {
      const currentSession = getCurrentSession();
      const evaluation = await evaluateAnswer(
        currentQuestion,
        answer
        // currentSession.followUpCount
      );

      // Update the current session
      const updatedSession = {
        ...currentSession,
        answers: [
          ...currentSession.answers,
          {
            text: answer,
            isFollowUp: currentSession.followUpCount > 0,
            evaluation: {
              score: evaluation.score,
              feedback: evaluation.response,
            },
          },
        ],
        score: Math.max(currentSession.score, evaluation.score),
        followUpCount:
          currentSession.followUpCount + (evaluation.followUpQuestion ? 1 : 0),
        isDone: evaluation.isQuestionDone,
      };
      updateCurrentSession(updatedSession);

      // Add the evaluation response to messages
      setMessages((prev) => [
        ...prev,
        {
          text: evaluation.response,
          isQuestion: false,
          isEvaluation: true,
          score: evaluation.score,
        },
      ]);

      if (evaluation.isGoodAnswer || evaluation.isQuestionDone) {
        // If answer is good or we're done with the question, wait a bit and show next question
        setTimeout(nextQuestion, 2000);
      } else if (evaluation.followUpQuestion) {
        // If answer needs improvement, show follow-up question
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { text: evaluation.followUpQuestion!, isQuestion: true },
          ]);
        }, 1500);
      }
    } catch (error) {
      console.error("Error during evaluation:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index === currentQuestionIndex) return;

    setMessages([
      { text: practiceQuestions[index].question, isQuestion: true },
    ]);
    setCurrentQuestionIndex(index);
    setCurrentQuestion(practiceQuestions[index].question);
    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[newMessages.length - 1] = {
        text: practiceQuestions[index].question,
        isQuestion: true,
      };
      return newMessages;
    });

    // Initialize question session if it doesn't exist
    if (!questionSessions[index]) {
      setQuestionSessions((prev) => {
        const newSessions = [...prev];
        newSessions[index] = {
          question: practiceQuestions[index].question,
          answers: [],
          score: 0,
          followUpCount: 0,
          isDone: false,
        };
        return newSessions;
      });
    }
  };

  const toggleListening = useCallback(async () => {
    if (!isListening) {
      try {
        await startRecording();
        setIsListening(true);
        setCurrentText("Recording...");
      } catch (error) {
        console.error("Failed to start recording:", error);
        setCurrentText("Error: Could not start recording");
      }
    } else {
      try {
        setIsTranscribing(true);
        setCurrentText("Transcribing...");
        const transcribedText = await stopRecording();
        setCurrentText(transcribedText);

        // Add user's answer to messages
        setMessages((prev) => [
          ...prev,
          { text: transcribedText, isQuestion: false },
        ]);

        // Evaluate the answer
        handleEvaluation(transcribedText);
        setIsListening(false);
      } catch (error) {
        console.error("Failed to stop recording:", error);
        setCurrentText("Error: Could not process recording");
        setIsListening(false);
      } finally {
        setIsTranscribing(false);
      }
    }
  }, [isListening, currentQuestion]);

  useEffect(() => {
    if (!isClient) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !event.repeat &&
        !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [toggleListening, isClient]);

  // const passCurrentQuestion = async () => {
  //   if (!isPracticeMode || isEvaluating) return;

  //   const currentQ = practiceQuestions[currentQuestionIndex];
  //   setIsEvaluating(true);

  //   // Add a perfect score message
  //   setMessages((prev) => [
  //     ...prev,
  //     {
  //       text: "Test passed successfully!",
  //       isQuestion: false,
  //       isEvaluation: true,
  //       score: 10,
  //     },
  //   ]);

  //   // Update question session
  //   setQuestionSessions((prev) => {
  //     const newSessions = [...prev];
  //     newSessions[currentQuestionIndex] = {
  //       questionId: currentQ.id,
  //       isDone: true,
  //       score: 10,
  //     };
  //     return newSessions;
  //   });

  //   // Update total score
  //   setTotalScore((prev) => {
  //     const newScore =
  //       (prev * currentQuestionIndex + 10) / (currentQuestionIndex + 1);
  //     return Math.round(newScore);
  //   });

  //   setIsEvaluating(false);
  //   // Move to next question if available
  //   if (currentQuestionIndex < practiceQuestions.length - 1) {
  //     setTimeout(() => {
  //       jumpToQuestion(currentQuestionIndex + 1);
  //     }, 1500);
  //   } else {
  //     setShowFinalScore(true);
  //   }
  // };

  if (!isClient) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Voice Recognition Practice
        </h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (showFinalScore) {
    return (
      <main className="max-w-3xl mx-auto p-8 text-center bg-white">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Practice Complete!
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Your Final Score</h2>
          <div className="text-5xl font-bold text-blue-600 mb-6">
            {totalScore}/10
          </div>
          <div className="space-y-4">
            {questionSessions.map((session, index) => (
              <div key={index} className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">
                  Question {index + 1}: {session.question}
                </h3>
                <p className="text-gray-600">Score: {session.score}/10</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          >
            Practice Again
          </button>
        </div>
      </main>
    );
  }

  if (!isPracticeMode) {
    return (
      <main className="relative w-full h-screen text-center">
        <SplashCursor />
        <div className="absolute cursor-pointer top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2  w-[200px] h-[200px] rounded-full overflow-hidden z-50 pointer-events-none"></div>
        <button
          onClick={startPractice}
          className=" z-50 cursor-pointer border border-[#333] bg-[rgba(0,0,0,0.2)] backdrop-blur-lg transition-all fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] text-[32px] font-semibold  opacity-90  rounded-full text-white "
        >
          Start
        </button>
        <div className="absolute top-[70%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[20px] font-semibold text-white">
          100 essential Javascript questions
        </div>
      </main>
    );
  }

  const currentSession = getCurrentSession();

  return (
    <main className="mx-auto text-center w-full">
      <div className="grid grid-cols-12 gap-4">
        <div className="py-8 px-4 col-span-4 border-r border-slate-900 h-screen text-left">
          <p className="text-left text-xl text-white mb-[12px]">
            Question {currentQuestionIndex + 1} of {practiceQuestions.length}
          </p>
          {currentSession && (
            <p className="text-left text-sm text-gray-300 mb-[24px]">
              Current Score: {currentSession.score}/10
              <br />
              Follow-up Questions: {currentSession.followUpCount}
            </p>
          )}
          <button
            onClick={toggleListening}
            disabled={isEvaluating || isTranscribing}
            className={`mb-4 px-4 py-2 text-md font-semibold rounded-[12px] transition-all duration-300
            ${
              isListening
                ? "bg-red-700 hover:bg-red-900"
                : isEvaluating || isTranscribing
                ? "bg-gray-400"
                : "bg-[#1E1E24] hover:bg-[#27272A]"
            } text-white`}
          >
            {currentText === "Transcribing..."
              ? currentText
              : isListening
              ? "Stop Recording"
              : isTranscribing
              ? "Transcribing..."
              : isEvaluating
              ? "Evaluating..."
              : "+ Start Recording"}
          </button>
          <p className="text-sm text-gray-200 pb-[40px] ">
            Press{" "}
            <kbd className="px-2 py-1 bg-[#1E1E24] rounded-md border border-gray-500">
              Space
            </kbd>{" "}
            to start/stop recording
          </p>
          <div className="relative overflow-y-auto h-[calc(100vh-150px)] shadow-inner">
            {practiceQuestions.map((q, index) => (
              <div
                key={index}
                onClick={() => isPracticeMode && jumpToQuestion(index)}
                className={`p-3 mb-2 rounded-[12px] cursor-pointer transition-all
                  ${
                    isPracticeMode
                      ? "hover:bg-[#41414e]"
                      : "opacity-50 cursor-not-allowed"
                  }
                  ${
                    currentQuestionIndex === index
                      ? "bg-gradient-to-br from-[#5D65D3] to-[#6483a8]"
                      : "bg-[#1E1E24]"
                  }
                  ${
                    questionSessions[index]?.isDone
                      ? "border-l-4 border-green-500"
                      : ""
                  }
                `}
              >
                <div className="text-sm text-gray-400 mb-1">{q.level}</div>
                <div className="text-white">{q.question}</div>
                {questionSessions[index]?.score > 0 && (
                  <div className="text-sm text-gray-400 mt-1">
                    Score: {questionSessions[index].score}/10
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-8 h-screen">
          <div className="flex h-full flex-col items-center gap-2 mb-[60px] p-8 col-span-8 overflow-y-scroll">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`text-white p-4 rounded-2xl max-w-[80%] ${
                  message.isQuestion
                    ? "bg-[#454553] mr-auto text-left"
                    : message.isEvaluation
                    ? "bg-[#1E1E24] mx-auto text-center"
                    : "bg-gradient-to-br from-[#5D65D3] to-[#57afbb] ml-auto text-right"
                }`}
              >
                {message.text}
                {message.score !== undefined && (
                  <div className="text-sm text-gray-300 mt-2">
                    Score: {message.score}/10
                  </div>
                )}
              </div>
            ))}
            {isPracticeMode && (
              <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto p-4">
                <button
                  onClick={() => setShowSuggestedAnswer(!showSuggestedAnswer)}
                  className="text-white px-4 rounded-md text-sm"
                >
                  {showSuggestedAnswer
                    ? "Hide Suggested Answer"
                    : "See Suggested Answer"}
                </button>
                {showSuggestedAnswer && (
                  <div className="bg-gray-100 p-4 rounded-[12px] mt-2">
                    <p className="text-gray-700">
                      {practiceQuestions[currentQuestionIndex].suggested_answer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
