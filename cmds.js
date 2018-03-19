
const Sequelize = require('sequelize')
const {models} = require('./model');
const {log, biglog, errorLog, colorize} = require('./out');

exports.helpCmd = rl => {
  log(" Comandos:");
  log(" h|help - Muestra esta ayuda.");
  log(" list - Listar los quizzes existentes.");
  log(" show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
  log(" add - Añadir un nuevo quiz interactivamente.");
  log(" delete <id> - Borrar el quiz indicado.");
  log(" edit <id> - Editar el quiz indicado.");
  log(" test <id> - Probar el quiz indicado.");
  log(" p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
  log(" credits - Créditos.");
  log(" q|quit - Salir del programa.");
  rl.prompt();
}

exports.quitCmd = rl => {
  rl.close();
}

const makeQuestion = (rl, text) => {
  return new Sequelize.Promise((resolve, reject) => {
    rl.question(colorize(text, 'red'), answer => {
      resolve(answer.trim());
    });
  });
}

exports.addCmd = rl => {
  makeQuestion(rl, ' Introduzca una pregunta: ')
  .then(q => {
    return makeQuestion(rl, ' Introduzca la respuesta: ')
    .then(a => {
      return {question: q, answer: a};
    });
  })
  .then(quiz => {
    return models.quiz.create(quiz);
  })
  .then(quiz => {
    log(` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`)
  })
  .catch(Sequelize.ValidationError, error => {
    errorLog('El quiz es erróneo:');
    error.errors.forEach(({message}) => errorLog(message));
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => {
    rl.prompt();
  })
}

exports.listCmd = rl => {
  models.quiz.findAll()
  .each(quiz => {
      log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => {
    rl.prompt();
  });
}

const validateId = id => {
  return new Sequelize.Promise((resolve, reject) => {
    if (typeof id === "undefined") {
      reject(new Error(`Falta parámetro <id>.`));
    } else {
      id = parseInt(id);
      if (Number.isNaN(id)) {
        reject(new Error(`El valor del parámetro <id> no es un número.`));
      } else {
        resolve(id);
      }
    }
  });
}

exports.showCmd = (rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id = ${id}.`)
    }
    log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => {
    rl.prompt();
  })
}

exports.testCmd = (rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id = ${id}.`);
    }
    makeQuestion(rl, ` ${colorize(quiz.question, 'red')}: `)
    .then(a => {
      log(' Su respuesta es:');
      a.match(/[]correct/gim)
      if (a.trim().toLowerCase() === quiz.answer.toLowerCase()) {
        log (' Su respuesta es correcta.');
        biglog('Correcta', 'green');
      } else {
        log (' Su respuesta es incorrecta.');
        biglog('Incorrecta', 'red');
      }
    })
    .then(() => rl.prompt())
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => rl.prompt())
}

exports.playCmd = rl => {
  let score = 0;
  let toBeResolved = [];

  models.quiz.findAll()
  .each(quiz => {
      toBeResolved.push({question: quiz.question, answer: quiz.answer});
    })
  .then(() => {
    const playOne = () => {
      if (toBeResolved.length === 0) {
        log(' No hay nada más que preguntar.');
        log(' Final del examen. Aciertos:');
        biglog(score, 'magenta');
        rl.prompt();

      } else {
        let quiz = toBeResolved[Math.floor(Math.random() * toBeResolved.length)];
        toBeResolved.splice(toBeResolved.indexOf(quiz), 1);

        makeQuestion(rl, colorize(` ${quiz.question}: `, 'red'))
        .then(a => {
          log(' Su respuesta es:');
          if (a.trim().toLowerCase() === quiz.answer.toLowerCase()) {
            score++;
            log(` CORRECTA - Lleva ${score} aciertos.`);
            playOne();
          } else {
            log(' INCORRECTA');
            log(` Final del examen. Aciertos:`);
            biglog(score, 'magenta');
            rl.prompt();
          }
        });
      }
    }
    playOne();
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => rl.prompt());
}

exports.deleteCmd = (rl, id) => {
  validateId(id)
  .then(id => {
    models.quiz.destroy({where: {id}})
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => {
    rl.prompt();
  });
}

exports.editCmd = (rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id = ${id}.`);
    }

    process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
    return makeQuestion(rl, ' Introduzca la pregunta: ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
      return makeQuestion(rl, ' Introduzca la respuesta: ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz => {
    return quiz.save()
  })
  .then(quiz => {
    log(` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por:
    ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorLog('El quiz es erróneo:');
    error.errors.forEach(({message}) => errorLog(message));
  })
  .catch(error => {
    errorLog(error.message);
  })
  .then(() => {
    rl.prompt();
  });

}

exports.creditsCmd = rl => {
  log(" Autor de la práctica:");
  log(" Vicente Bartual Ferrán");
  rl.prompt();
}
