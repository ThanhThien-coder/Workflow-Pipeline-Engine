package com.pipeline.wpe;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class WpeApplication {

    public static void main(String[] args) {
        SpringApplication.run(WpeApplication.class, args);
    }

}
