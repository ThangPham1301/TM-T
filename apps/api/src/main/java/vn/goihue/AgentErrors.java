package vn.goihue;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes={AgentApi.class, RecommendApi.class, AiPrivacyApi.class})
class AgentErrors {
    private final PlatformApi app;
    AgentErrors(PlatformApi app) { this.app = app; }

    @ExceptionHandler(Exception.class)
    ResponseEntity<?> error(Exception error) {
        if (error instanceof MethodArgumentTypeMismatchException)
            return app.error(new PlatformApi.Problem(422, "Tham số không hợp lệ."));
        return app.error(error);
    }
}
